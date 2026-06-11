/**
 * Admin add-Member form.
 * Port of apps/web/src/routes/admin/-components/add-member-form.tsx
 *
 * Provisions a new Member (username-only; no email per ADR 0010) then immediately
 * issues a Password link (ADR 0016) and opens the native share sheet. The link
 * step is best-effort: a Member that was created but didn't get a link still
 * appears in the list — the key button re-issues.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { getClient, run } from '@/client/api-client';
import { Palette } from '@/constants/theme';
import { adminMembersKey } from '../queries';
import { sharePasswordLinkMessage } from '../helpers';

export function AddMemberForm() {
  const [newUsername, setNewUsername] = useState('');
  const queryClient = useQueryClient();

  const addMember = useMutation({
    mutationFn: async (username: string) => {
      // Member-create is pure (returns the Member); the Password link is a SEPARATE issue (ADR 0016). The
      // add flow chains them — provision, then issue a link — but the link is BEST-EFFORT: once the Member
      // is created they must show in the list and the create must NOT be retried (the username is now
      // taken). So a link-issuance failure doesn't fail the whole mutation; it returns `link: null` for
      // onSuccess to handle, and the key button in the list re-issues.
      const client = await getClient();
      const member = await run(client.members.create({ payload: { username } }));
      try {
        const link = await run(client.memberPasswordLink.create({ params: { id: member.id } }));
        return { member, link };
      } catch {
        return { member, link: null };
      }
    },
    onSuccess({ member, link }) {
      setNewUsername('');
      void queryClient.invalidateQueries({ queryKey: adminMembersKey });
      if (link) {
        void sharePasswordLinkMessage(member.username, link.token);
      } else {
        Alert.alert(
          `${member.username} added`,
          "But the link didn't generate. Tap the key button to retry.",
        );
      }
    },
    onError(e) {
      // Reached only when member-CREATE failed (e.g. UsernameTaken — its typed message is human).
      Alert.alert(
        "Couldn't add member",
        e instanceof Error && e.message ? e.message : 'Try again.',
      );
    },
  });

  function submit() {
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) return;
    addMember.mutate(trimmed);
  }

  return (
    <View className="flex-row gap-2">
      <TextInput
        value={newUsername}
        onChangeText={setNewUsername}
        placeholder="username"
        placeholderTextColor={Palette.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        onSubmitEditing={submit}
        returnKeyType="done"
        style={{ color: Palette.ink }}
        className="h-12 flex-1 rounded-xl border border-line bg-white px-4 text-base"
      />
      <Pressable
        onPress={submit}
        disabled={addMember.isPending || newUsername.trim().length < 3}
        className={`h-12 items-center justify-center rounded-xl bg-flame px-4 ${addMember.isPending || newUsername.trim().length < 3 ? 'opacity-60' : ''}`}
      >
        <Text className="text-sm font-medium text-white">
          {addMember.isPending ? 'Adding…' : 'Add Member'}
        </Text>
      </Pressable>
    </View>
  );
}
