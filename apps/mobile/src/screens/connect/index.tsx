import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getPublicClient, run } from '@/client/api-client';
import { normalizeServerUrl, setServerUrl } from '@/client/server';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

const PROBE_TIMEOUT_MS = 10_000;

/**
 * The Connect tier — first run of a bring-your-own-backend app (ADR 0018). The Member enters their
 * household's server URL; the public setup-status probe doubles as "is this actually a Sufra server?".
 * `needsSetup` means a fresh deploy with no Host yet — Setup stays a web ritual, so the app points
 * there instead of storing the origin. On success the origin becomes user state and the gate advances
 * to sign-in.
 */
export default function ConnectScreen() {
  // EXPO_PUBLIC_API_URL is the dev prefill only — in the emulator you type nothing (ADR 0018).
  const [url, setUrl] = useState(process.env.EXPO_PUBLIC_API_URL ?? '');
  const [error, setError] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  const canSubmit = url.trim().length > 0 && !probing;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setProbing(true);
    const origin = normalizeServerUrl(url);
    try {
      const status = await Promise.race([
        run((await getPublicClient(origin)).setup.show()),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timed out')), PROBE_TIMEOUT_MS)
        ),
      ]);
      if (status.needsSetup) {
        setError(`This server hasn't been set up yet. Finish setup at ${origin} first, then connect.`);
        return;
      }
      setServerUrl(origin);
    } catch {
      setError(`Couldn't find a Sufra server at ${origin}. Check the address and try again.`);
    } finally {
      setProbing(false);
    }
  }

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6">
        <View className="mx-auto w-full max-w-md gap-8">
          <View className="items-center gap-1">
            <Image
              source={require('@/assets/images/sufra-circle.png')}
              style={{ width: 72, height: 72 }}
            />
            <DisplayText className="text-4xl text-ink">Sufra</DisplayText>
            <Text className="text-base text-ink-soft text-center">Connect to your server</Text>
          </View>

          <View className="gap-3">
            <TextInput
              className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
              style={{ color: Palette.ink }}
              value={url}
              onChangeText={setUrl}
              placeholder="family.example.com"
              placeholderTextColor={Palette.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!probing}
            />
            <Text className="text-sm text-ink-soft">
              The web address of your household&apos;s Sufra server.
            </Text>

            {error ? <Text className="text-sm text-red">{error}</Text> : null}

            <Pressable
              disabled={!canSubmit}
              onPress={onSubmit}
              className="mt-2 h-12 items-center justify-center rounded-[9999px] bg-flame">
              {probing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">Connect</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
