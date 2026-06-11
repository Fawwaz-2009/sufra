import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchUnlockPriceString,
  isUserCancelled,
  purchaseUnlock,
  restorePurchases,
  startTrial,
  useEntitlement,
} from '@/client/entitlement';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

/**
 * The unlock tier's only screen, in two modes off the same entitlement read: no trial yet → start
 * the 30-day trial (a price-0 App Store purchase, so the clock is Apple-timestamped); trial over →
 * the hard lock, one one-time purchase out. A successful purchase or restore flips the entitlement
 * store and the root gate advances on its own — this screen never navigates.
 */
export default function PaywallScreen() {
  const entitlement = useEntitlement();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'trial' | 'unlock' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void fetchUnlockPriceString().then((p) => {
      if (live) setPrice(p);
    });
    return () => {
      live = false;
    };
  }, []);

  async function perform(action: 'trial' | 'unlock' | 'restore') {
    if (busy) return;
    setError(null);
    setBusy(action);
    try {
      if (action === 'trial') await startTrial();
      else if (action === 'unlock') await purchaseUnlock();
      else await restorePurchases();
    } catch (e) {
      if (!isUserCancelled(e)) {
        setError(
          action === 'restore'
            ? "Couldn't restore purchases. Check your connection and try again."
            : "The App Store couldn't complete the purchase. Try again in a moment."
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const expired = entitlement.kind === 'expired';

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.white }}>
      <View className="flex-1 justify-center px-6">
        <View className="mx-auto w-full max-w-md gap-8">
          <View className="items-center gap-3">
            <Image
              source={require('@/assets/images/sufra-circle.png')}
              style={{ width: 72, height: 72 }}
            />
            <DisplayText className="text-3xl text-ink text-center">
              {expired ? 'Your trial has ended' : 'Try Sufra free for 30 days'}
            </DisplayText>
            <Text className="text-base text-ink-soft text-center">
              {expired
                ? 'Unlock Sufra once and the app is yours forever. No subscription. Your data stays on your own server, and the web app is always free.'
                : 'After the trial, a single one-time purchase unlocks the app forever. No subscription.'}
            </Text>
          </View>

          <View className="gap-3">
            {error ? <Text className="text-sm text-red text-center">{error}</Text> : null}

            <Pressable
              disabled={busy !== null}
              onPress={() => void perform(expired ? 'unlock' : 'trial')}
              className="h-12 items-center justify-center rounded-[9999px] bg-flame">
              {busy === 'trial' || busy === 'unlock' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  {expired
                    ? `Unlock forever${price ? ` · ${price}` : ''}`
                    : 'Start free trial'}
                </Text>
              )}
            </Pressable>

            <Pressable
              disabled={busy !== null}
              onPress={() => void perform('restore')}
              className="h-12 items-center justify-center px-4">
              {busy === 'restore' ? (
                <ActivityIndicator color={Palette.flame} />
              ) : (
                <Text className="text-sm font-medium text-flame">Restore purchases</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
