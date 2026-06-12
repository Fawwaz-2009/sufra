import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Pressable } from '@/components/pressable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAuthClient } from '@/client/auth-client';
import { DisplayText } from '@/components/display-text';
import { Palette } from '@/constants/theme';

export default function SignInScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    const result = await getAuthClient().signIn.username({
      username: username.trim(),
      password,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error.message ?? t`Could not sign in. Check your username and password.`);
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
            <Text className="text-base text-ink-soft text-center"><Trans>Sign in to continue</Trans></Text>
          </View>

          <View className="gap-3">
            <TextInput
              className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
              style={{ color: Palette.ink }}
              onChangeText={setUsername}
              placeholder={t`Username`}
              placeholderTextColor={Palette.inkFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              editable={!submitting}
            />
            <TextInput
              className="rounded-2xl bg-surface px-4 py-4 text-[17px]"
              style={{ color: Palette.ink }}
              onChangeText={setPassword}
              placeholder={t`Password`}
              placeholderTextColor={Palette.inkFaint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!submitting}
            />

            {error ? <Text className="text-sm text-red">{error}</Text> : null}

            <Pressable
              disabled={!canSubmit}
              onPress={onSubmit}
              className="mt-2 h-12 items-center justify-center rounded-[9999px] bg-flame">
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white"><Trans>Sign in</Trans></Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
