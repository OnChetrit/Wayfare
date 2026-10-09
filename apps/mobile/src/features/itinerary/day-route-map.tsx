import type { TripEditorTrip } from '@wayfare/domain';
import * as React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { TripMap } from '@/components/trip-map';
import { Card } from '@/components/ui/card';
import { useDayPlanMap } from '@/features/itinerary/use-day-plan-map';
import { itineraryRouteMapData } from '@/features/itinerary/itinerary-route-map';
import { useMapRouteLinePreference } from '@/lib/use-map-route-line-preference';
import { colors } from '@/theme/tokens';
import { useTheme } from '@/theme/theme-provider';

export function DayRouteMap({
  date,
  trip,
  onSelectDay,
}: {
  date: string;
  trip: TripEditorTrip;
  onSelectDay?: (date: string) => void;
}) {
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

  const { days, places: stops, routes: dayLines } = itineraryRouteMapData(trip, date);

  return (
    <View style={{ gap: 10 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ maxHeight: 180 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectDay?.('')}
          style={{ padding: 12 }}
        >
          <Text style={{ color: themeColors.text }}>All days</Text>
        </Pressable>
        {days.map(day => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityLabel={`Day ${day.dayNumber}, ${day.date}`}
            accessibilityState={{ selected: date === day.date }}
            onPress={() => onSelectDay?.(day.date)}
            style={{ padding: 12, borderLeftWidth: 5, borderColor: day.color }}
          >
            <Text style={{ color: themeColors.text }}>
              Day {day.dayNumber} · {day.date}
              {!day.stops.length ? ' · No mapped stops' : ''}
              {day.unmappedCount ? ` · ${day.unmappedCount} unmapped` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {mapPlaces.length || stops.length ? (
        <View style={{ height: 360, overflow: 'hidden', borderRadius: 20 }}>
          <TripMap
            fitToPlaces
            fitKey={`${trip.id}:${date || 'overview'}`}
            places={[
              ...stops,
              ...mapPlaces.filter(
                place => !stops.some(stop => stop.lat === place.lat && stop.lng === place.lng),
              ),
            ]}
            routes={[...dayLines, ...routes.filter(route => route.dashed)]}
            showRouteLines={showRouteLines}
            onSelectPlace={place => {
              const daysAtPlace = days.filter(day =>
                day.stops.some(
                  stop => stop.place.lat === place.lat && stop.place.lng === place.lng,
                ),
              );
              if (daysAtPlace.length === 1) onSelectDay?.(daysAtPlace[0].date);
              else
                Alert.alert(
                  'Visiting days',
                  place.name,
                  daysAtPlace.map(day => ({
                    text: `Day ${day.dayNumber} · ${day.date}`,
                    onPress: () => onSelectDay?.(day.date),
                  })),
                );
            }}
          />
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
        Numbered days match the legend. In a focused day, markers show stop order. Dashed blue lines
        are flights. Flight airport coordinates load only when requested.
      </Text>
    </View>
  );
}
