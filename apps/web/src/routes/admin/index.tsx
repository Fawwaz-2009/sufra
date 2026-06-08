import { useState } from "react"
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"

import { BottomNav } from "@/components/bottom-nav"
import { requireHost } from "@/client/gate"
import { AddMemberForm } from "./-components/add-member-form"
import { AdminHeader, AdminShell } from "./-components/admin-shell"
import { CostCard } from "./-components/cost-card"
import { DeleteMemberDialog } from "./-components/delete-member-dialog"
import { AdminError } from "./-components/error"
import { MembersList } from "./-components/members-list"
import { ModelSelect } from "./-components/model-select"
import { AdminPending } from "./-components/pending"
import { Section } from "./-components/section"
import {
  inferenceCostQueryOptions,
  membersQueryOptions,
  monthRangeUtc,
  settingsQueryOptions,
  type Member,
} from "./-queries"

export const Route = createFileRoute("/admin/")({
  beforeLoad: ({ context }) => requireHost(context.queryClient),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(
        inferenceCostQueryOptions(monthRangeUtc())
      ),
      context.queryClient.ensureQueryData(settingsQueryOptions()),
      context.queryClient.ensureQueryData(membersQueryOptions()),
    ]),
  pendingComponent: AdminPending,
  errorComponent: AdminError,
  component: Admin,
})

function Admin() {
  const cost = useSuspenseQuery(inferenceCostQueryOptions(monthRangeUtc())).data
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)

  return (
    <AdminShell>
      <AdminHeader />

      <main className="flex-1 px-5 pb-24">
        <CostCard
          totalUsd={cost.totalUsd}
          perMemberAvgUsd={cost.perMemberAvgUsd}
          runCount={cost.runCount}
        />

        <ModelSelect />

        <Section title="Members">
          <AddMemberForm />
          <MembersList onDelete={setMemberToDelete} />
        </Section>
      </main>

      <DeleteMemberDialog
        member={memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      />

      <BottomNav />
    </AdminShell>
  )
}
