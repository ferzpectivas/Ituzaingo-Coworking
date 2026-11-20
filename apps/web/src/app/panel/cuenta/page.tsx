import type { Metadata } from 'next';
import { AccountSecurity } from '@/components/account/account-security';

export const metadata: Metadata = {
  title: 'Mi cuenta',
};

export default function CuentaPage() {
  return <AccountSecurity />;
}
