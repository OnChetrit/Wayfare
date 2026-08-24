import { PublicLayout } from '@/features/public/PublicLayout';

export default function PublicRouteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PublicLayout>{children}</PublicLayout>;
}
