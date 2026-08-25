import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Link } from 'expo-router';
import * as React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { WayfareMark } from '@/components/wayfare-mark';
import { exchangeSessionFromUrl, supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'signup';

type AuthFormProps = {
  mode: AuthMode;
};

WebBrowser.maybeCompleteAuthSession();

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AuthForm({ mode }: AuthFormProps) {
  const isLogin = mode === 'login';
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const redirectTo = React.useMemo(() => Linking.createURL('auth/callback'), []);

  function validateCredentials() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setMessage('Enter a valid email address.');
      return null;
    }

    if (password.length < 6) {
      setMessage('Your password must be at least 6 characters.');
      return null;
    }

    return normalizedEmail;
  }

  async function submitWithEmail() {
    const normalizedEmail = validateCredentials();
    if (!normalizedEmail) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (error) throw error;

        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      if (data.session) {
        return;
      }

      setMessage('Check your inbox to confirm your Wayfare account.');
    } catch (error) {
      setMessage(messageFromError(error, 'We could not authenticate you. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithGoogle() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;
      if (!data.url) throw new Error('Google sign-in did not return an authorization URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'cancel' || result.type === 'dismiss') return;
      if (result.type !== 'success')
        throw new Error('Google sign-in did not complete. Please try again.');

      const exchangeError = await exchangeSessionFromUrl(result.url);
      if (exchangeError) throw exchangeError;
    } catch (error) {
      setMessage(messageFromError(error, 'Google sign-in failed. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const submitLabel = isLogin ? 'Sign in to Wayfare' : 'Create account';

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
      style={{ backgroundColor: '#08211C', flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
          paddingVertical: 36,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.duration(420)} style={{ gap: 16, marginBottom: 34 }}>
          <WayfareMark size={58} />
          <View style={{ gap: 8 }}>
            <Text
              selectable
              style={{ color: '#F8F4EB', fontSize: 32, fontWeight: '700', letterSpacing: -0.9 }}
            >
              {isLogin ? 'Continue planning.' : 'Start your next trip.'}
            </Text>
            <Text selectable style={{ color: '#B6C8C1', fontSize: 16, lineHeight: 24 }}>
              {isLogin
                ? 'Your places, plans, and details are ready when you are.'
                : 'A quieter, clearer place for every good travel idea.'}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.duration(420).delay(100)}
          style={{
            backgroundColor: '#12362E',
            borderColor: '#285147',
            borderCurve: 'continuous',
            borderRadius: 28,
            borderWidth: 1,
            gap: 18,
            padding: 22,
          }}
        >
          <Pressable
            accessibilityLabel="Continue with Google"
            disabled={isSubmitting}
            onPress={signInWithGoogle}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: '#F8F4EB',
              borderCurve: 'continuous',
              borderRadius: 15,
              flexDirection: 'row',
              gap: 10,
              justifyContent: 'center',
              minHeight: 52,
              opacity: isSubmitting ? 0.55 : pressed ? 0.82 : 1,
              paddingHorizontal: 18,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#08211C" />
            ) : (
              <Text style={{ color: '#4285F4', fontSize: 19, fontWeight: '700' }}>G</Text>
            )}
            <Text selectable style={{ color: '#08211C', fontSize: 16, fontWeight: '700' }}>
              Continue with Google
            </Text>
          </Pressable>

          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
            <View style={{ backgroundColor: '#315D51', flex: 1, height: 1 }} />
            <Text
              selectable
              style={{ color: '#9FB8AD', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}
            >
              OR USE EMAIL
            </Text>
            <View style={{ backgroundColor: '#315D51', flex: 1, height: 1 }} />
          </View>

          <View style={{ gap: 14 }}>
            <View style={{ gap: 7 }}>
              <Text selectable style={{ color: '#D8E5DE', fontSize: 14, fontWeight: '600' }}>
                Email address
              </Text>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#7F9A8F"
                style={{
                  backgroundColor: '#0B2822',
                  borderColor: '#315D51',
                  borderCurve: 'continuous',
                  borderRadius: 14,
                  borderWidth: 1,
                  color: '#F8F4EB',
                  fontSize: 16,
                  minHeight: 52,
                  paddingHorizontal: 15,
                }}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={{ gap: 7 }}>
              <Text selectable style={{ color: '#D8E5DE', fontSize: 14, fontWeight: '600' }}>
                Password
              </Text>
              <TextInput
                accessibilityLabel="Password"
                autoCapitalize="none"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor="#7F9A8F"
                secureTextEntry
                style={{
                  backgroundColor: '#0B2822',
                  borderColor: '#315D51',
                  borderCurve: 'continuous',
                  borderRadius: 14,
                  borderWidth: 1,
                  color: '#F8F4EB',
                  fontSize: 16,
                  minHeight: 52,
                  paddingHorizontal: 15,
                }}
                textContentType={isLogin ? 'password' : 'newPassword'}
                value={password}
              />
            </View>
          </View>

          <Pressable
            accessibilityLabel={submitLabel}
            disabled={isSubmitting}
            onPress={() => void submitWithEmail()}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: '#E7B96F',
              borderCurve: 'continuous',
              borderRadius: 15,
              minHeight: 54,
              justifyContent: 'center',
              opacity: isSubmitting ? 0.55 : pressed ? 0.82 : 1,
              paddingHorizontal: 18,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#08211C" />
            ) : (
              <Text selectable style={{ color: '#08211C', fontSize: 16, fontWeight: '800' }}>
                {submitLabel}
              </Text>
            )}
          </Pressable>

          {message ? (
            <Text
              selectable
              style={{
                backgroundColor: '#0B2822',
                borderColor: '#315D51',
                borderCurve: 'continuous',
                borderRadius: 14,
                borderWidth: 1,
                color: '#D8E5DE',
                fontSize: 14,
                lineHeight: 21,
                padding: 13,
              }}
            >
              {message}
            </Text>
          ) : null}

          <Text
            selectable
            style={{ color: '#B6C8C1', fontSize: 14, lineHeight: 21, textAlign: 'center' }}
          >
            {isLogin ? 'New to Wayfare? ' : 'Already have an account? '}
            <Link
              href={isLogin ? '/signup' : '/login'}
              style={{ color: '#E7B96F', fontWeight: '700' }}
            >
              {isLogin ? 'Create one' : 'Sign in'}
            </Link>
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
