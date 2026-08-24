import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Icon sf="suitcase.fill" md="luggage" />
        <NativeTabs.Trigger.Label>Trips</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="itinerary">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle.fill" md="format_list_bulleted" />
        <NativeTabs.Trigger.Label>Itinerary</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon sf="receipt.fill" md="receipt_long" />
        <NativeTabs.Trigger.Label>Expenses</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
