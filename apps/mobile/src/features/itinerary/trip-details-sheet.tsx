import { Link } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import type { TripEditorTrip } from '@wayfare/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/state';
import { formatDateRange } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

export type TripDetailsKind = 'flights' | 'locations' | 'places' | 'stays';

type TripDetailsSheetProps = {
  kind: TripDetailsKind;
  trip: TripEditorTrip;
  initialDate?: string;
};

const detailCopy: Record<
  TripDetailsKind,
  { emptyDetail: string; emptyTitle: string; title: string }
> = {
  flights: {
    emptyDetail: 'Search by flight number to add a flight to this trip.',
    emptyTitle: 'No flights yet',
    title: 'Flights',
  },
  locations: {
    emptyDetail: 'Add another location when your trip moves to a new area.',
    emptyTitle: 'One location is all set',
    title: 'Locations',
  },
  places: {
    emptyDetail: 'Save a place from Explore or add one with its map coordinates.',
    emptyTitle: 'No saved places yet',
    title: 'Saved places',
  },
  stays: {
    emptyDetail: 'Add accommodation to keep check-in details handy.',
    emptyTitle: 'No stays yet',
    title: 'Stays',
  },
};

export function TripDetailsSheet({ kind, trip, initialDate }: TripDetailsSheetProps) {
  const copy = detailCopy[kind];
  const addHref = {
    pathname: '/itinerary-editor' as const,
    params:
      kind === 'flights'
        ? { kind: 'flight', ...(initialDate ? { date: initialDate } : {}) }
        : { kind: kind === 'locations' ? 'segment' : kind.slice(0, -1) },
  };
  const addLabel =
    kind === 'flights'
      ? 'Find a flight'
      : kind === 'locations'
        ? 'Add a location'
        : `Add ${kind === 'places' ? 'a saved place' : 'a stay'}`;
  const hasItems =
    kind === 'places'
      ? trip.places.length > 0
      : kind === 'stays'
        ? trip.stays.length > 0
        : kind === 'flights'
          ? trip.flights.length > 0
          : trip.locationSegments.length > 0;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ gap: space.md, padding: space.md, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
        {copy.title}
      </Text>
      {kind === 'places'
        ? trip.places.map(place => (
            <Card key={place.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {place.emoji} {place.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {place.subtitle}
              </Text>
              <Link
                href={{ pathname: '/itinerary-editor', params: { kind: 'place', id: place.id } }}
                push
                asChild
              >
                <Button tone="secondary">Edit details</Button>
              </Link>
            </Card>
          ))
        : null}
      {kind === 'stays'
        ? trip.stays.map(stay => (
            <Card key={stay.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {stay.name}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {formatDateRange(stay.checkInDate, stay.checkOutDate)}
              </Text>
              <Link
                href={{ pathname: '/itinerary-editor', params: { kind: 'stay', id: stay.id } }}
                push
                asChild
              >
                <Button tone="secondary">Edit details</Button>
              </Link>
            </Card>
          ))
        : null}
      {kind === 'flights'
        ? trip.flights.map(flight => (
            <Card key={flight.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {flight.flightNumber} · {flight.airlineName ?? 'Flight'}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {flight.scheduledDepartureLocal} · {flight.status}
              </Text>
            </Card>
          ))
        : null}
      {kind === 'locations'
        ? trip.locationSegments.map(segment => (
            <Card key={segment.id}>
              <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {segment.locationName}
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {formatDateRange(segment.startDate, segment.endDate)}
              </Text>
              <Link
                href={{
                  pathname: '/itinerary-editor',
                  params: { kind: 'segment', id: segment.id },
                }}
                push
                asChild
              >
                <Button tone="secondary">Edit details</Button>
              </Link>
            </Card>
          ))
        : null}
      {!hasItems ? <EmptyState title={copy.emptyTitle} detail={copy.emptyDetail} /> : null}
      <Link href={addHref} push asChild>
        <Button>{addLabel}</Button>
      </Link>
    </ScrollView>
  );
}
