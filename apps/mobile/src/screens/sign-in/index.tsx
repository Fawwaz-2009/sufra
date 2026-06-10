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

import { getAuthClient } from '@/client/auth-client';

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
      setError(result.error.message ?? 'Could not sign in. Check your username and password.');
    }
  }

  return (
    // className does not reach SafeAreaView — react-native-css only wraps SafeAreaProvider
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center px-6">
        <View className="mx-auto w-full max-w-md gap-8">
          <View className="items-center gap-1">
            <Text className="text-4xl font-bold text-black">Sufra</Text>
            <Text className="text-base text-zinc-500">Sign in to continue</Text>
          </View>

          <View className="gap-3">
            <TextInput
              className="rounded-2xl bg-zinc-100 px-4 py-4 text-[17px] text-black"
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor="#71717A"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              editable={!submitting}
            />
            <TextInput
              className="rounded-2xl bg-zinc-100 px-4 py-4 text-[17px] text-black"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#71717A"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
              editable={!submitting}
            />

            {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

            <Pressable
              disabled={!canSubmit}
              onPress={onSubmit}
              className="mt-2 h-12 items-center justify-center rounded-[9999px] bg-emerald-800">
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="text-base font-semibold text-white">Sign in</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
