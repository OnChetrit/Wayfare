import { Link } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, ReduceMotion } from 'react-native-reanimated';

import { WayfareMark } from '@/components/wayfare-mark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/theme/theme-provider';

const capabilities = [
  {
    detail: 'Save cafés, museums, neighborhoods, and every “we should go here” in one calm place.',
    number: '01',
    title: 'Keep every place close',
  },
  {
    detail: 'Shape a visual itinerary around your own pace, with room for spontaneous detours.',
    number: '02',
    title: 'Let days take shape',
  },
  {
    detail: 'Keep stays, flights, and shared expenses beside the plan when you need them.',
    number: '03',
    title: 'Travel with clarity',
  },
] as const;

export function OnboardingScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView
      contentContainerStyle={{ alignItems: 'center', padding: 24, paddingVertical: 30 }}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ gap: 30, maxWidth: 620, width: '100%' }}>
        <Animated.View
          entering={FadeInDown.duration(360).reduceMotion(ReduceMotion.System)}
          style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}
        >
          <WayfareMark size={44} />
          <Text
            selectable
            style={{ color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 }}
          >
            Wayfare
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(420).delay(70).reduceMotion(ReduceMotion.System)}
          style={{ gap: 14 }}
        >
          <Text
            selectable
            style={{ color: colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -1.2 }}
          >
            Make room for the good parts of your trip.
          </Text>
          <Text selectable style={{ color: colors.textMuted, fontSize: 17, lineHeight: 26 }}>
            Wayfare brings your places, days, and little details together, so planning feels as good
            as getting there.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(420).delay(140).reduceMotion(ReduceMotion.System)}
          style={{ gap: 10 }}
        >
          <Link href="/signup" asChild>
            <Button accessibilityLabel="Create a Wayfare account" style={{ minHeight: 54 }}>
              Start planning
            </Button>
          </Link>
          <Link href="/login" asChild>
            <Button
              accessibilityLabel="Sign in to Wayfare"
              style={{ minHeight: 52 }}
              tone="secondary"
            >
              I have an account
            </Button>
          </Link>
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' }}
          >
            No spreadsheets. No pressure.
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(440).delay(210).reduceMotion(ReduceMotion.System)}
          style={{ gap: 12 }}
        >
          <Text
            selectable
            style={{ color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 }}
          >
            PLAN A TRIP YOUR WAY
          </Text>
          {capabilities.map(capability => (
            <Card key={capability.number} style={{ gap: 10, padding: 18 }}>
              <View style={{ alignItems: 'center', flexDirection: 'row', gap: 10 }}>
                <Text
                  selectable
                  style={{
                    color: colors.accent,
                    fontSize: 13,
                    fontVariant: ['tabular-nums'],
                    fontWeight: '800',
                  }}
                >
                  {capability.number}
                </Text>
                <Text
                  selectable
                  style={{ color: colors.text, flex: 1, fontSize: 17, fontWeight: '800' }}
                >
                  {capability.title}
                </Text>
              </View>
              <Text selectable style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22 }}>
                {capability.detail}
              </Text>
            </Card>
          ))}
        </Animated.View>

        <Text
          selectable
          style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center' }}
        >
          Start with one place you’re excited about. Wayfare will help you build the rest from
          there.
        </Text>
      </View>
    </ScrollView>
  );
}
