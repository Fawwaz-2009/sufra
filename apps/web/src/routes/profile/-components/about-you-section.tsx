import { useState } from "react"

import { LogWeightSheet } from "@/components/log-weight-sheet"
import { cmToImperial, kgToLb } from "@/lib/units"
import { ageFromBirthday } from "@/worker/views/derive"
import type { ProfileSnapshotView as ProfileSnapshot } from "@/worker/views/profile-snapshot"
import { ACTIVITY_LABELS } from "../-helpers"
import { ActivitySheet } from "./activity-sheet"
import { BirthdaySheet } from "./birthday-sheet"
import { HeightSheet } from "./height-sheet"
import { Row, SectionCard } from "./section-card"
import { SexSheet } from "./sex-sheet"

type OpenSheet = "sex" | "birthday" | "height" | "weight" | "activity"

export function AboutYouSection({ profile }: { profile: ProfileSnapshot }) {
  const [open, setOpen] = useState<OpenSheet | null>(null)
  const ageYears = ageFromBirthday(profile.birthday)
  return (
    <SectionCard label="About you">
      <Row
        label="Sex"
        value={profile.sex === "male" ? "Male" : "Female"}
        onClick={() => setOpen("sex")}
      />
      <Row
        label="Birthday"
        value={`${profile.birthday} · ${ageYears} yr`}
        onClick={() => setOpen("birthday")}
      />
      <Row
        label="Height"
        value={formatHeight(profile.heightCm, profile.displayHeightUnit)}
        onClick={() => setOpen("height")}
      />
      <Row
        label="Weight"
        value={formatWeight(profile.weightKg, profile.displayWeightUnit)}
        onClick={() => setOpen("weight")}
      />
      <Row
        label="Activity"
        value={ACTIVITY_LABELS[profile.activityLevel]}
        onClick={() => setOpen("activity")}
      />

      <SexSheet
        open={open === "sex"}
        onOpenChange={(v) => setOpen(v ? "sex" : null)}
        profile={profile}
      />
      <BirthdaySheet
        open={open === "birthday"}
        onOpenChange={(v) => setOpen(v ? "birthday" : null)}
        profile={profile}
      />
      <HeightSheet
        open={open === "height"}
        onOpenChange={(v) => setOpen(v ? "height" : null)}
        profile={profile}
      />
      <LogWeightSheet
        open={open === "weight"}
        onOpenChange={(v) => setOpen(v ? "weight" : null)}
        profile={profile}
      />
      <ActivitySheet
        open={open === "activity"}
        onOpenChange={(v) => setOpen(v ? "activity" : null)}
        profile={profile}
      />
    </SectionCard>
  )
}

function formatHeight(cm: number, unit: "cm" | "imperial"): string {
  if (unit === "cm") return `${cm} cm`
  const { feet, inches } = cmToImperial(cm)
  return `${feet}'${inches}"`
}

function formatWeight(kg: number, unit: "kg" | "lb"): string {
  if (unit === "kg") return `${Math.round(kg * 10) / 10} kg`
  return `${Math.round(kgToLb(kg))} lb`
}
