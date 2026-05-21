// Display-unit conversion between canonical storage (cm / kg) and the
// imperial display formats (ft+in / lb). Canonical numbers are what the
// formula module always sees; these helpers exist solely for input and
// display rendering.

const CM_PER_INCH = 2.54
const KG_PER_LB = 0.45359237
const LB_PER_KG = 1 / KG_PER_LB

export function cmToImperial(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_INCH
  const feetRaw = Math.floor(totalIn / 12)
  // Round inches; if it rounds up to 12, carry into feet.
  const inches = Math.round(totalIn - feetRaw * 12)
  if (inches === 12) return { feet: feetRaw + 1, inches: 0 }
  return { feet: feetRaw, inches }
}

export function imperialToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * CM_PER_INCH)
}

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function formatHeight(cm: number, unit: "cm" | "imperial"): string {
  if (unit === "cm") return `${cm} cm`
  const { feet, inches } = cmToImperial(cm)
  return `${feet}'${inches}"`
}

export function formatWeight(kg: number, unit: "kg" | "lb"): string {
  if (unit === "kg") return `${Math.round(kg * 10) / 10} kg`
  return `${Math.round(kgToLb(kg))} lb`
}
