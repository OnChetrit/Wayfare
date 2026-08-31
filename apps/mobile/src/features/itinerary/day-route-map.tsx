import type { TripEditorTrip } from '@wayfare/domain';
import * as React from 'react';
import { Pressable, Text, View } from 'react-native';

import { TripMap } from '@/components/trip-map';
import { Card } from '@/components/ui/card';
import { useDayPlanMap } from '@/features/itinerary/use-day-plan-map';
import { useMapRouteLinePreference } from '@/lib/use-map-route-line-preference';
import { colors } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

export function DayRouteMap({ date, trip }: { date: string; trip: TripEditorTrip }) {
  const { colors: themeColors } = useTheme();
  const { showRouteLines, setShowRouteLines } = useMapRouteLinePreference();
  const airportLoadKey = `${trip.id}:${date}`;
  const [loadedAirportMaps, setLoadedAirportMaps] = React.useState<Record<string, true>>({});
  const loadAirports = Boolean(loadedAirportMaps[airportLoadKey]);
  const { hasAirportRequests, isLoadingAirports, mapPlaces, routes } = useDayPlanMap({
    date,
    loadAirports,
    trip,
  });

  if (!mapPlaces.length && !hasAirportRequests) {
    return (
      <Card>
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          No route coordinates yet
        </Text>
        <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
          Add coordinates to a location or save places to this day to see the route here.
        </Text>
      </Card>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {mapPlaces.length ? (
        <View style={{ height: 360, overflow: 'hidden', borderRadius: 20 }}>
          <TripMap fitToPlaces places={mapPlaces} routes={routes} showRouteLines={showRouteLines} />
        </View>
      ) : (
        <Card>
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            Flight route available
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            Load its airport markers to show the flight on the map.
          </Text>
        </Card>
      )}
      <Pressable
        accessibilityLabel="Route lines"
        accessibilityRole="button"
        accessibilityState={{ selected: showRouteLines }}
        onPress={() => setShowRouteLines(!showRouteLines)}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          backgroundColor: showRouteLines ? themeColors.accent : themeColors.surfaceMuted,
          borderColor: showRouteLines ? themeColors.accent : themeColors.borderStrong,
          borderCurve: 'continuous',
          borderRadius: 12,
          borderWidth: 1,
          minHeight: 40,
          opacity: pressed ? 0.75 : 1,
          paddingHorizontal: 12,
          justifyContent: 'center',
        })}
      >
        <Text
          selectable
          style={{
            color: showRouteLines ? themeColors.accentText : themeColors.text,
            fontSize: 14,
            fontWeight: '700',
          }}
        >
          Route lines
        </Text>
      </Pressable>
      {hasAirportRequests && !loadAirports ? (
        <Pressable
          accessibilityHint="Fetches airport coordinates for this route"
          accessibilityLabel="Show flight airport markers"
          accessibilityRole="button"
          onPress={() => setLoadedAirportMaps(current => ({ ...current, [airportLoadKey]: true }))}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            backgroundColor: themeColors.surfaceMuted,
            borderColor: themeColors.borderStrong,
            borderCurve: 'continuous',
            borderRadius: 12,
            borderWidth: 1,
            minHeight: 40,
            opacity: pressed ? 0.75 : 1,
            paddingHorizontal: 12,
            justifyContent: 'center',
          })}
        >
          <Text selectable style={{ color: themeColors.text, fontSize: 14, fontWeight: '700' }}>
            Show flight airports
          </Text>
        </Pressable>
      ) : null}
      {isLoadingAirports ? (
        <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
          Loading airport markers…
        </Text>
      ) : null}
      <Text selectable style={{ color: colors.textMuted, fontSize: 13 }}>
        Green lines are the day route. Dashed blue lines are flights. Flight airport coordinates
        load only when requested.
      </Text>
    </View>
  );
}
