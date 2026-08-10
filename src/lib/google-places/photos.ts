export type GooglePlacePhoto = {
  name?: string;
  authorAttributions?: Array<{
    displayName?: string;
    uri?: string;
  }>;
};

export type GooglePlacePhotoImage = {
  url: string;
  attributions: Array<{
    name: string;
    uri?: string;
  }>;
};

const maximumPhotoWidth = 960;

function isPhotoName(value: string): boolean {
  const segments = value.split('/');
  return (
    segments.length === 4 &&
    segments[0] === 'places' &&
    segments[1].length > 0 &&
    segments[2] === 'photos' &&
    segments[3].length > 0 &&
    !segments.some(segment => segment === '.' || segment === '..')
  );
}

function isHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function getGooglePlacePhotoImages(
  apiKey: string,
  photos: GooglePlacePhoto[] | undefined,
  limit = 3,
): Promise<GooglePlacePhotoImage[]> {
  const photoCandidates = (photos ?? []).filter(
    (photo): photo is GooglePlacePhoto & { name: string } =>
      Boolean(photo.name && isPhotoName(photo.name)),
  );

  const images = await Promise.all(
    photoCandidates.slice(0, limit).map(async (photo): Promise<GooglePlacePhotoImage | null> => {
      const [, placeId, , photoReference] = photo.name.split('/');
      const searchParams = new URLSearchParams({
        key: apiKey,
        maxWidthPx: String(maximumPhotoWidth),
        skipHttpRedirect: 'true',
      });
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}/photos/${encodeURIComponent(photoReference)}/media?${searchParams.toString()}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return null;

      const media = (await response.json()) as { photoUri?: string };
      if (!isHttpsUrl(media.photoUri)) return null;

      return {
        url: media.photoUri,
        attributions: (photo.authorAttributions ?? []).flatMap(attribution =>
          attribution.displayName
            ? [
                {
                  name: attribution.displayName,
                  uri: isHttpsUrl(attribution.uri) ? attribution.uri : undefined,
                },
              ]
            : [],
        ),
      };
    }),
  );

  return images.filter((image): image is GooglePlacePhotoImage => image !== null);
}
