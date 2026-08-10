import { TripHeaderLayout } from '@/features/trip-editor/TripHeaderLayout';

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TripHeaderLayout>{children}</TripHeaderLayout>;
}
