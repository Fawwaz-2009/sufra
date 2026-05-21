import { SectionCard } from "./section-card"

// Sign Out moved to the Profile header's top-right corner — the Saved Meals
// section below would otherwise push body-anchored Sign-Out off-screen as
// the Member accumulates bookmarks. See PRD §6.11 + ADR 0008.
export function AccountSection({ username }: { username: string }) {
  return (
    <SectionCard label="Account">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-muted-foreground">Username</span>
        <span className="text-sm">{username}</span>
      </div>
    </SectionCard>
  )
}
