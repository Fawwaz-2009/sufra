import { useMemo, useState } from "react"

import { Sheet } from "@/components/ui/sheet"
import type { Sex } from "../../../../worker/profile/isomorphic/constants"
import { deriveProfile } from "../../../../worker/profile/isomorphic/derive"
import type { ProfileSnapshot } from "../../../../worker/profile/schema"
import { useProfilePatch } from "../-helpers"
import { ChipButton } from "./chip-button"
import { PreviewBox, SheetShell } from "./sheet-shell"

export function SexSheet({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  profile: ProfileSnapshot
}) {
  const [value, setValue] = useState<Sex>(profile.sex)
  const { save, saving } = useProfilePatch()
  const previous = useMemo(() => deriveProfile(profile).targetKcal, [profile])
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetShell
        title="Which formula should we use?"
        onSave={async () => {
          if (await save({ sex: value })) onOpenChange(false)
        }}
        saving={saving}
        disabled={value === profile.sex}
      >
        <div className="grid grid-cols-2 gap-2">
          <ChipButton
            label="Male"
            selected={value === "male"}
            onClick={() => setValue("male")}
          />
          <ChipButton
            label="Female"
            selected={value === "female"}
            onClick={() => setValue("female")}
          />
        </div>
        <PreviewBox
          inputs={{ ...profile, sex: value }}
          previousTarget={previous}
        />
      </SheetShell>
    </Sheet>
  )
}
