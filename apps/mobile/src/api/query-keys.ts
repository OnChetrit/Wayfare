export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trips', tripId] as const,
  invitations: (tripId: string) => ['trips', tripId, 'invitations'] as const,
  members: (tripId: string) => ['trips', tripId, 'members'] as const,
  reminders: (tripId: string) => ['trips', tripId, 'reminders'] as const,
  reminderList: (tripId: string, status: 'OPEN' | 'COMPLETED') =>
    ['trips', tripId, 'reminders', status] as const,
};
