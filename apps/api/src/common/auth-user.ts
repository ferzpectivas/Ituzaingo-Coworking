import type { Role } from '../storage/types';

export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
  personId: string;
  firstName: string;
  lastName: string;
  docLast4: string;
}

export interface RequestWithUser {
  user?: AuthUser;
  cookies?: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  url?: string;
  method?: string;
  correlationId?: string;
}
