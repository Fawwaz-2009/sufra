/**
 * Admin Members list (with inline delete confirmation).
 * Port of apps/web/src/routes/admin/-components/members-list.tsx
 *   + apps/web/src/routes/admin/-components/delete-member-dialog.tsx (merged)
 *
 * On RN the delete confirmation is a native Alert (no dialog component), so
 * the list owns both mutations. Uniform 404 scoping (ADR 0013) means a Member
 * that no longer exists returns 404 — the onError handler surfaces it as a
 * human-readable alert without exposing authz details.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Pressable, Text, View } from 'react-native';
import { getClient, run } from '@/client/api-client';
import { adminMembersKey, membersQueryOptions, type Member } from '../queries';
import { sharePasswordLinkMessage } from '../helpers';

export function MembersList() {
  const membersQuery = useQuery(membersQueryOptions());
  const members = membersQuery.data ?? [];
  const queryClient = useQueryClient();

  const generateLink = useMutation({
    mutationFn: async (memberId: string) =>
      run((await getClient()).memberPasswordLink.create({ params: { id: memberId } })),
    onSuccess(link, memberId) {
      const m = members.find((x) => x.id === memberId);
      void sharePasswordLinkMessage(m?.username ?? '', link.token);
    },
    onError() {
      Alert.alert("Couldn't create link", 'Try again.');
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (memberId: string) =>
      run((await getClient()).members.destroy({ params: { id: memberId } })),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: adminMembersKey });
    },
    onError() {
      Alert.alert("Couldn't delete", 'Try again.');
    },
  });

  function confirmDelete(m: Member) {
    Alert.alert(
      `Delete ${m.username}?`,
      `This deletes ${m.username} and everything they logged — meals, photos, weights. Inference cost stays on the books. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMember.mutate(m.id) },
      ],
    );
  }

  if (members.length === 0 && !membersQuery.isLoading) {
    return (
      <View className="rounded-xl border border-zinc-200 bg-white px-4 py-6">
        <Text className="text-center text-sm text-zinc-500">No Members yet. Add one above.</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {members.map((m) => (
        <View
          key={m.id}
          className="flex-row items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
        >
          {/* Avatar placeholder */}
          <View className="h-8 w-8 rounded-[9999px] bg-zinc-200" />

          <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium text-black">
            {m.username}
          </Text>

          {/* Re-issue Password link (ADR 0016) */}
          <Pressable
            accessibilityLabel={`Share password link for ${m.username}`}
            disabled={generateLink.isPending && generateLink.variables === m.id}
            onPress={() => generateLink.mutate(m.id)}
            className="h-9 w-9 items-center justify-center rounded-[9999px]"
          >
            <Text className="text-base">🔑</Text>
          </Pressable>

          {/* Delete Member — confirm via native Alert */}
          <Pressable
            accessibilityLabel={`Delete ${m.username}`}
            onPress={() => confirmDelete(m)}
            className="h-9 w-9 items-center justify-center rounded-[9999px]"
          >
            <Text className="text-base">🗑️</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
