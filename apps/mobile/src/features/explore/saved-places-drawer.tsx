import { FlashList } from '@shopify/flash-list';
import type { SavedPlace } from '@wayfare/domain';
import * as React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  filterSavedPlaces,
  savedPlacesFilterOptions,
  type SavedPlacesFilter,
} from '@/features/explore/saved-places-filter';
import { colors, space } from '@/theme/tokens';

type SavedPlacesDrawerProps = {
  onClose: () => void;
  onSelectPlace: (place: SavedPlace) => void;
  places: SavedPlace[];
  selectedPlaceId?: string;
  visiblePlaceIds: string[];
  visible: boolean;
};

function filterLabel(filter: SavedPlacesFilter) {
  if (filter === 'ALL') return 'All';
  if (filter === 'FAVORITES') return 'Favorites';
  return filter.charAt(0) + filter.slice(1).toLocaleLowerCase();
}

const SavedPlaceRow = React.memo(function SavedPlaceRow({
  onSelectPlace,
  place,
  selected,
}: {
  onSelectPlace: (place: SavedPlace) => void;
  place: SavedPlace;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityHint="Centers this place on the map and opens its actions"
      accessibilityLabel={`Show ${place.name} on the map`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelectPlace(place)}
      style={({ pressed }) => ({
        backgroundColor: selected ? colors.surfaceMuted : 'transparent',
        borderColor: colors.border,
        borderBottomWidth: 1,
        flexDirection: 'row',
        gap: 10,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: space.md,
        paddingVertical: 13,
      })}
    >
      <Text selectable style={{ fontSize: 20 }}>
        {place.emoji}
      </Text>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
          <Text
            selectable
            numberOfLines={1}
            style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' }}
          >
            {place.name}
          </Text>
          {place.isFavorite ? (
            <Text selectable style={{ color: colors.accent, fontSize: 16 }}>
              ★
            </Text>
          ) : null}
        </View>
        <Text
          selectable
          numberOfLines={2}
          style={{ color: colors.textMuted, fontSize: 13, lineHeight: 18 }}
        >
          {place.subtitle}
        </Text>
      </View>
    </Pressable>
  );
});

export function SavedPlacesDrawer({
  onClose,
  onSelectPlace,
  places,
  selectedPlaceId,
  visiblePlaceIds,
  visible,
}: SavedPlacesDrawerProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.86, 380);
  const [filter, setFilter] = React.useState<SavedPlacesFilter>('ALL');
  const [mapAreaOnly, setMapAreaOnly] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [isClosing, setIsClosing] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferredQuery = React.useDeferredValue(query);
  const visiblePlaceIdSet = React.useMemo(() => new Set(visiblePlaceIds), [visiblePlaceIds]);
  const filteredPlaces = React.useMemo(
    () =>
      filterSavedPlaces(places, filter, deferredQuery).filter(
        place => !mapAreaOnly || visiblePlaceIdSet.has(place.id),
      ),
    [deferredQuery, filter, mapAreaOnly, places, visiblePlaceIdSet],
  );
  const hasFilters = filter !== 'ALL' || mapAreaOnly || query.trim().length > 0;
  const renderPlace = React.useCallback(
    ({ item }: { item: SavedPlace }) => (
      <SavedPlaceRow
        onSelectPlace={onSelectPlace}
        place={item}
        selected={item.id === selectedPlaceId}
      />
    ),
    [onSelectPlace, selectedPlaceId],
  );
  const dismiss = React.useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimer.current = setTimeout(onClose, 220);
  }, [isClosing, onClose]);

  React.useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={{ flex: 1 }}>
        {!isClosing ? (
          <>
            <Animated.View
              entering={FadeIn.duration(160)}
              exiting={FadeOut.duration(180)}
              style={{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }}
            >
              <Pressable
                accessibilityLabel="Close saved places"
                accessibilityRole="button"
                onPress={dismiss}
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.42)', flex: 1 }}
              />
            </Animated.View>
            <Animated.View
              accessibilityViewIsModal
              entering={SlideInLeft.duration(240)}
              exiting={SlideOutLeft.duration(220)}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.borderStrong,
                borderRightWidth: 1,
                bottom: 0,
                boxShadow: '8px 0 24px rgba(0, 0, 0, 0.28)',
                left: 0,
                paddingTop: insets.top,
                position: 'absolute',
                top: 0,
                width: drawerWidth,
              }}
            >
              <View style={{ gap: 10, padding: space.md }}>
                <View
                  style={{
                    alignItems: 'center',
                    flexDirection: 'row',
                    gap: space.sm,
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      selectable
                      style={{ color: colors.text, fontSize: 21, fontWeight: '800' }}
                    >
                      Saved places
                    </Text>
                    <Text
                      selectable
                      style={{ color: colors.textMuted, fontVariant: ['tabular-nums'] }}
                    >
                      {filteredPlaces.length === places.length
                        ? `${places.length} ${places.length === 1 ? 'place' : 'places'} on your map`
                        : `${filteredPlaces.length} of ${places.length} places`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close saved places"
                    accessibilityRole="button"
                    onPress={dismiss}
                    style={({ pressed }) => ({
                      alignItems: 'center',
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.borderStrong,
                      borderCurve: 'continuous',
                      borderRadius: 16,
                      borderWidth: 1,
                      height: 40,
                      justifyContent: 'center',
                      opacity: pressed ? 0.72 : 1,
                      width: 40,
                    })}
                  >
                    <Text selectable style={{ color: colors.text, fontSize: 22, lineHeight: 24 }}>
                      ×
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  accessibilityLabel="Search saved places"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                  onChangeText={setQuery}
                  placeholder="Search saved places"
                  placeholderTextColor={colors.textMuted}
                  selectionColor={colors.accent}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderCurve: 'continuous',
                    borderRadius: 12,
                    borderWidth: 1,
                    color: colors.text,
                    fontSize: 16,
                    minHeight: 42,
                    paddingHorizontal: 12,
                  }}
                  value={query}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {savedPlacesFilterOptions.map(option => {
                    const active = option === filter;
                    return (
                      <Pressable
                        accessibilityLabel={`Filter saved places by ${filterLabel(option)}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        key={option}
                        onPress={() => setFilter(option)}
                        style={({ pressed }) => ({
                          backgroundColor: active ? colors.accent : colors.surfaceMuted,
                          borderColor: active ? colors.accent : colors.border,
                          borderCurve: 'continuous',
                          borderRadius: 14,
                          borderWidth: 1,
                          opacity: pressed ? 0.72 : 1,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        })}
                      >
                        <Text
                          selectable
                          style={{
                            color: active ? colors.accentText : colors.text,
                            fontSize: 13,
                            fontWeight: '700',
                          }}
                        >
                          {filterLabel(option)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityLabel="Show only places in the current map area"
                    accessibilityRole="button"
                    accessibilityState={{ selected: mapAreaOnly }}
                    onPress={() => setMapAreaOnly(current => !current)}
                    style={({ pressed }) => ({
                      backgroundColor: mapAreaOnly ? colors.accent : colors.surfaceMuted,
                      borderColor: mapAreaOnly ? colors.accent : colors.border,
                      borderCurve: 'continuous',
                      borderRadius: 14,
                      borderWidth: 1,
                      opacity: pressed ? 0.72 : 1,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    })}
                  >
                    <Text
                      selectable
                      style={{
                        color: mapAreaOnly ? colors.accentText : colors.text,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      Map area
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>
              <FlashList
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                data={filteredPlaces}
                drawDistance={320}
                extraData={selectedPlaceId}
                keyExtractor={place => place.id}
                ListEmptyComponent={
                  <View style={{ gap: 8, padding: space.md, paddingTop: space.lg }}>
                    <Text
                      selectable
                      style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}
                    >
                      {hasFilters ? 'No matching places' : 'No saved places yet'}
                    </Text>
                    <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
                      {hasFilters
                        ? 'Try another search or filter.'
                        : 'Search the map and save places to find them here.'}
                    </Text>
                  </View>
                }
                renderItem={renderPlace}
              />
            </Animated.View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}
