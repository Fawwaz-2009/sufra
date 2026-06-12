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

import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Text, View } from 'react-native';
import { Pressable } from '@/components/pressable';
import { getClient, run } from '@/client/api-client';
import { haptics } from '@/lib/haptics';
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
      Alert.alert(t`Couldn't create link`, t`Try again.`);
    },
  });

  const deleteMember = useMutation({
    mutationFn: async (memberId: string) =>
      run((await getClient()).members.destroy({ params: { id: memberId } })),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: adminMembersKey });
    },
    onError() {
      Alert.alert(t`Couldn't delete`, t`Try again.`);
    },
  });

  function confirmDelete(m: Member) {
    Alert.alert(
      t`Delete ${m.username}?`,
      t`This deletes ${m.username} and everything they logged — meals, photos, weights. Inference cost stays on the books. This cannot be undone.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Delete`,
          style: 'destructive',
          onPress: () => {
            haptics.destructive();
            deleteMember.mutate(m.id);
          },
        },
      ],
    );
  }

  if (members.length === 0 && !membersQuery.isLoading) {
    return (
      <View className="rounded-xl border border-line bg-white px-4 py-6">
        <Text className="text-center text-sm text-ink-soft">
          <Trans>No Members yet. Add one above.</Trans>
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {members.map((m) => (
        <View
          key={m.id}
          className="flex-row items-center gap-3 rounded-xl border border-line bg-white px-4 py-3"
        >
          <Text numberOfLines={1} className="min-w-0 flex-1 text-sm font-medium text-ink">
            {m.username}
          </Text>

          {/* Hosts are listed (the full household) but get NO actions — the server's Member-scoped
              gates 404 them anyway (ADR 0013); the badge says why. */}
          {m.role === 'host' ? (
            <View className="rounded-[9999px] bg-surface px-3 py-1">
              <Text className="text-xs font-medium text-ink-soft">
                <Trans>Host</Trans>
              </Text>
            </View>
          ) : (
            <>
              {/* Re-issue Password link (ADR 0016) */}
              <Pressable
                accessibilityLabel={t`Share password link for ${m.username}`}
                disabled={generateLink.isPending && generateLink.variables === m.id}
                onPress={() => generateLink.mutate(m.id)}
                className="h-9 items-center justify-center rounded-[9999px] px-3"
              >
                <Text className="text-sm font-medium text-flame">
                  <Trans>Link</Trans>
                </Text>
              </Pressable>

              {/* Delete Member — confirm via native Alert */}
              <Pressable
                accessibilityLabel={t`Delete ${m.username}`}
                onPress={() => confirmDelete(m)}
                className="h-9 items-center justify-center rounded-[9999px] px-3"
              >
                <Text className="text-sm font-medium text-red">
                  <Trans>Delete</Trans>
                </Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
