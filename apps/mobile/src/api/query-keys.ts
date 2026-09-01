export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trips', tripId] as const,
  reminders: (tripId: string) => ['trips', tripId, 'reminders'] as const,
  reminderList: (tripId: string, status: 'OPEN' | 'COMPLETED') =>
    ['trips', tripId, 'reminders', status] as const,
};
