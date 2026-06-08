import { useMemo, useState } from "react"

import { Sheet } from "@/components/ui/sheet"
import type { ActivityLevel } from "@/worker/models/profile-snapshot"
import { deriveProfile } from "@/worker/views/derive"
import type { ProfileSnapshotView as ProfileSnapshot } from "@/worker/views/profile-snapshot"
import {
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_LABELS,
  useProfilePatch,
} from "../-helpers"
import { ChipButton } from "./chip-button"
import { PreviewBox, SheetShell } from "./sheet-shell"

export function ActivitySheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [value, setValue] = useState<ActivityLevel>(profile.activityLevel)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Activity level"
        onSave={async () => {
          if (await save({ activityLevel: value })) onOpenChange(false)
        }}
        saving={saving}
        disabled={value === profile.activityLevel}
      >
        <div className="flex flex-col gap-2">
          {(["sedentary", "light", "moderate", "active"] as const).map((v) => (
            <ChipButton
              key={v}
              label={ACTIVITY_LABELS[v]}
              description={ACTIVITY_DESCRIPTIONS[v]}
              selected={value === v}
              onClick={() => setValue(v)}
            />
          ))}
        </div>
        <PreviewBox
          inputs={{ ...profile, activityLevel: value }}
          previousTarget={previous}
        />
      </SheetShell>
    </Sheet>
  )
}
