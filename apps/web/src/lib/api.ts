export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly detail?: string;
  readonly meta?: unknown;
  readonly errors?: Array<{ field: string; message: string }>;

  constructor(
    status: number,
    message: string,
    options: { code?: string; meta?: unknown; errors?: Array<{ field: string; message: string }> } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options.code;
    this.detail = message;
    this.meta = options.meta;
    this.errors = options.errors;
  }
}

interface ProblemPayload {
  detail?: string;
  message?: string;
  code?: string;
  meta?: unknown;
  errors?: Array<{ field: string; message: string }>;
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

interface ApiOptions extends RequestInit {
  retry?: boolean;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { retry = true, headers, ...rest } = options;
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...rest,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(rest.body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    cache: 'no-store',
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    const renewed = await refreshSession();
    if (renewed) {
      return api<T>(path, { ...options, retry: false });
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    let payload: ProblemPayload = {};
    if (contentType.includes('json')) {
      try {
        payload = (await response.json()) as ProblemPayload;
      } catch {
        payload = {};
      }
    } else {
      payload = { detail: await response.text() };
    }
    throw new ApiError(
      response.status,
      payload.detail ?? payload.message ?? 'No se pudo completar la operación.',
      { code: payload.code, meta: payload.meta, errors: payload.errors },
    );
  }

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export async function apiBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  if (response.status === 401) {
    const renewed = await refreshSession();
    if (renewed) return apiBlob(path);
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'No se pudo descargar el archivo.');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return { blob: await response.blob(), filename: match?.[1] ?? 'descarga' };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
