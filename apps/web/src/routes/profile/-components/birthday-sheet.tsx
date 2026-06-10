import { useMemo, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet } from "@/components/ui/sheet"
import { deriveProfile } from "@/worker/views/derive"
import type { ProfileSnapshotView as ProfileSnapshot } from "@/worker/views/profile-snapshot"
import { useProfilePatch } from "../-helpers"
import { PreviewBox, SheetShell } from "./sheet-shell"

export function BirthdaySheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [value, setValue] = useState(profile.birthday)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  const isoValid = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Your birthday"
        onSave={async () => {
          if (await save({ birthday: value })) onOpenChange(false)
        }}
        saving={saving}
        disabled={!isoValid || value === profile.birthday}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="bd">Birthday</Label>
          <Input
            id="bd"
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        {isoValid && (
          <PreviewBox
            inputs={{ ...profile, birthday: value }}
            previousTarget={previous}
          />
        )}
      </SheetShell>
    </Sheet>
  )
}
