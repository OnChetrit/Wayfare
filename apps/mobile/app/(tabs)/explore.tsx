import { ScrollView, View } from 'react-native';
import { NativeMapBottomSheet } from '@/components/native-map-bottom-sheet';
import { TripMap } from '@/components/trip-map';

export default function ExploreScreen() {
  return (
    <NativeMapBottomSheet background={<TripMap />}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={{ minHeight: 240 }} />
      </ScrollView>
    </NativeMapBottomSheet>
  );
}
