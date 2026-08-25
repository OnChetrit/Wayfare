export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trips', tripId] as const,
};
