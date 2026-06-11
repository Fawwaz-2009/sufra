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
  trialDaysLeft,
  useEntitlement,
} from '@/client/entitlement';
import { getServerUrl } from '@/client/server';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

/**
 * The unlock screen, mode-switched off the entitlement store. As the gate tier: no trial yet → the
 * start screen (a continuation of the Connect ceremony — the "Connected" line confirms the step
 * that just succeeded); trial over → the hard lock. Pushed from Profile during a trial: the early
 * unlock. A successful purchase or restore flips the store and the gate (or the `unlocked` mode)
 * takes it from there — this screen never navigates.
 */
export default function PaywallScreen() {
  const entitlement = useEntitlement();
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'trial' | 'unlock' | 'restore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    setNotice(null);
    setBusy(action);
    try {
      if (action === 'trial') await startTrial();
      else if (action === 'unlock') await purchaseUnlock();
      else {
        const restored = await restorePurchases();
        if (restored.kind === 'trialAvailable' || restored.kind === 'expired') {
          setNotice('No purchases found for this Apple Account.');
        }
      }
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

  if (entitlement.kind === 'loading') return null;

  const unlockLabel = `Unlock forever${price ? ` · ${price}` : ''}`;
  const copy = (() => {
    switch (entitlement.kind) {
      case 'trialAvailable':
        return {
          title: 'Try Sufra free for 30 days',
          body: 'After the trial, a single one-time purchase unlocks the app forever. No subscription.',
        };
      case 'trial': {
        const days = trialDaysLeft(entitlement.endsAt);
        return {
          title: `${days} day${days === 1 ? '' : 's'} left in your trial`,
          body: 'Unlock Sufra once and the app is yours forever. No subscription.',
        };
      }
      case 'expired':
        return {
          title: 'Your trial has ended',
          body: 'Unlock Sufra once and the app is yours forever. No subscription. Your data stays on your own server, and the web app is always free.',
        };
      case 'unlocked':
        return {
          title: 'Sufra is yours',
          body: 'Unlocked forever on this Apple Account — across every device signed into it.',
        };
    }
  })();

  // The gate's start mode follows the Connect step directly; naming the server keeps it one flow.
  const connectedTo =
    entitlement.kind === 'trialAvailable' ? getServerUrl()?.replace(/^https?:\/\//, '') : null;

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
            {connectedTo ? (
              <Text className="text-xs font-medium uppercase text-ink-faint">
                Connected to {connectedTo}
              </Text>
            ) : null}
            <DisplayText className="text-3xl text-ink text-center">{copy.title}</DisplayText>
            <Text className="text-base text-ink-soft text-center">{copy.body}</Text>
          </View>

          {entitlement.kind !== 'unlocked' ? (
            <View className="gap-3">
              {error ? <Text className="text-sm text-red text-center">{error}</Text> : null}
              {notice ? <Text className="text-sm text-ink-soft text-center">{notice}</Text> : null}

              <Pressable
                disabled={busy !== null}
                onPress={() =>
                  void perform(entitlement.kind === 'trialAvailable' ? 'trial' : 'unlock')
                }
                className="h-12 items-center justify-center rounded-[9999px] bg-flame">
                {busy === (entitlement.kind === 'trialAvailable' ? 'trial' : 'unlock') ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">
                    {entitlement.kind === 'trialAvailable' ? 'Start free trial' : unlockLabel}
                  </Text>
                )}
              </Pressable>

              {entitlement.kind === 'trialAvailable' ? (
                <Pressable
                  disabled={busy !== null}
                  onPress={() => void perform('unlock')}
                  className="h-12 items-center justify-center px-4">
                  {busy === 'unlock' ? (
                    <ActivityIndicator color={Palette.flame} />
                  ) : (
                    <Text className="text-sm font-medium text-flame">{unlockLabel}</Text>
                  )}
                </Pressable>
              ) : null}

              <Pressable
                disabled={busy !== null}
                onPress={() => void perform('restore')}
                className="h-12 items-center justify-center px-4">
                {busy === 'restore' ? (
                  <ActivityIndicator color={Palette.inkSoft} />
                ) : (
                  <Text className="text-sm font-medium text-ink-soft">Restore purchases</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
