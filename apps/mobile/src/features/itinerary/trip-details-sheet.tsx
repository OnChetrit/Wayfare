import {
  Button as SwiftButton,
  Host,
  HStack,
  Label,
  List,
  Section,
  Spacer,
  Text as SwiftText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, listStyle } from '@expo/ui/swift-ui/modifiers';
import { Link, router } from 'expo-router';
import { ScrollView, Text } from 'react-native';

import type { TripEditorTrip } from '@wayfare/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/state';
import { flightDetailRows } from '@/features/itinerary/flight-details';
import { formatDateRange, formatMoney } from '@/lib/format';
import { colors, space } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

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
  const { colors: themeColors, theme } = useTheme();
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

  if (process.env.EXPO_OS === 'ios') {
    const navigateToEditor = (editorKind: 'flight' | 'place' | 'segment' | 'stay', id: string) => {
      router.push({ pathname: '/itinerary-editor', params: { kind: editorKind, id } });
    };

    return (
      <Host colorScheme={theme} seedColor={themeColors.accent} style={{ flex: 1 }}>
        <List modifiers={[listStyle('insetGrouped')]}>
          <Section
            footer={
              <SwiftText>
                {hasItems
                  ? `Manage the ${copy.title.toLocaleLowerCase()} for this trip.`
                  : copy.emptyDetail}
              </SwiftText>
            }
            title={copy.title}
          >
            {kind === 'places'
              ? trip.places.map(place => (
                  <SwiftButton
                    key={place.id}
                    modifiers={[buttonStyle('plain')]}
                    onPress={() => navigateToEditor('place', place.id)}
                  >
                    <HStack spacing={12}>
                      <Label
                        title={`${place.emoji} ${place.name}`}
                        systemImage="mappin.and.ellipse"
                      />
                      <Spacer />
                      <SwiftText>›</SwiftText>
                    </HStack>
                  </SwiftButton>
                ))
              : null}
            {kind === 'stays'
              ? trip.stays.map(stay => (
                  <SwiftButton
                    key={stay.id}
                    modifiers={[buttonStyle('plain')]}
                    onPress={() => navigateToEditor('stay', stay.id)}
                  >
                    <HStack spacing={12}>
                      <VStack alignment="leading" spacing={3}>
                        <Label title={stay.name} systemImage="bed.double" />
                        <SwiftText>
                          {formatDateRange(stay.checkInDate, stay.checkOutDate)}
                        </SwiftText>
                        {stay.locationLabel || stay.address ? (
                          <SwiftText>{stay.locationLabel ?? stay.address}</SwiftText>
                        ) : null}
                        {stay.priceAmount != null && stay.priceCurrency ? (
                          <SwiftText>{formatMoney(stay.priceAmount, stay.priceCurrency)}</SwiftText>
                        ) : null}
                      </VStack>
                      <Spacer />
                      <SwiftText>›</SwiftText>
                    </HStack>
                  </SwiftButton>
                ))
              : null}
            {kind === 'flights'
              ? trip.flights.map(flight => (
                  <SwiftButton
                    key={flight.id}
                    modifiers={[buttonStyle('plain')]}
                    onPress={() => navigateToEditor('flight', flight.id)}
                  >
                    <HStack spacing={12}>
                      <VStack alignment="leading" spacing={3}>
                        <Label
                          title={`${flight.flightNumber} · ${flight.airlineName ?? 'Flight'}`}
                          systemImage="airplane"
                        />
                        {flightDetailRows(flight).map(row => (
                          <SwiftText key={row}>{row}</SwiftText>
                        ))}
                      </VStack>
                      <Spacer />
                      <SwiftText>›</SwiftText>
                    </HStack>
                  </SwiftButton>
                ))
              : null}
            {kind === 'locations'
              ? trip.locationSegments.map(segment => (
                  <SwiftButton
                    key={segment.id}
                    modifiers={[buttonStyle('plain')]}
                    onPress={() => navigateToEditor('segment', segment.id)}
                  >
                    <HStack spacing={12}>
                      <VStack alignment="leading" spacing={3}>
                        <Label title={segment.locationName} systemImage="map" />
                        <SwiftText>{formatDateRange(segment.startDate, segment.endDate)}</SwiftText>
                      </VStack>
                      <Spacer />
                      <SwiftText>›</SwiftText>
                    </HStack>
                  </SwiftButton>
                ))
              : null}
            {!hasItems ? <Label title={copy.emptyTitle} systemImage="tray" /> : null}
          </Section>
          {trip.access.canEdit ? (
            <Section>
              <SwiftButton
                label={addLabel}
                systemImage="plus"
                onPress={() => router.push(addHref)}
              />
            </Section>
          ) : null}
        </List>
      </Host>
    );
  }

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
              {stay.locationLabel || stay.address ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  {stay.locationLabel ?? stay.address}
                </Text>
              ) : null}
              {stay.priceAmount != null && stay.priceCurrency ? (
                <Text selectable style={{ color: colors.textMuted }}>
                  {formatMoney(stay.priceAmount, stay.priceCurrency)}
                </Text>
              ) : null}
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
              {flightDetailRows(flight).map(row => (
                <Text key={row} selectable style={{ color: colors.textMuted }}>
                  {row}
                </Text>
              ))}
              {trip.access.canEdit ? (
                <Link
                  href={{
                    pathname: '/itinerary-editor',
                    params: { kind: 'flight', id: flight.id },
                  }}
                  push
                  asChild
                >
                  <Button tone="secondary">Edit flight</Button>
                </Link>
              ) : null}
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
      {trip.access.canEdit ? (
        <Link href={addHref} push asChild>
          <Button>{addLabel}</Button>
        </Link>
      ) : null}
    </ScrollView>
  );
}
