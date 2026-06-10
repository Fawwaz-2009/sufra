import { useState } from 'react';
import { View } from 'react-native';

import { kgToLb, lbToKg } from '@/lib/units';
import { LabeledInput } from '@/components/labeled-input';
import { StepHeading } from './step-heading';
import { UnitToggle } from '@/components/unit-toggle';

export function StepWeight({
  weightKg,
  unit,
  onWeightChange,
  onUnitChange,
}: {
  weightKg: number | null;
  unit: 'kg' | 'lb';
  onWeightChange: (kg: number) => void;
  onUnitChange: (u: 'kg' | 'lb') => void;
}) {
  // Local text state so typing "93.5" doesn't get round-tripped through the
  // numeric parent state, which would strip the trailing dot mid-keystroke
  // and turn "93.5" into "935".
  const [text, setText] = useState<string>(() =>
    weightKg == null
      ? ''
      : unit === 'kg'
        ? String(Math.round(weightKg * 10) / 10)
        : String(Math.round(kgToLb(weightKg)))
  );
  const handleUnitChange = (u: 'kg' | 'lb') => {
    onUnitChange(u);
    if (weightKg != null) {
      setText(
        u === 'kg' ? String(Math.round(weightKg * 10) / 10) : String(Math.round(kgToLb(weightKg)))
      );
    }
  };
  const handleTextChange = (v: string) => {
    setText(v);
    if (v === '' || v === '.' || v === '-') return;
    const n = Number(v);
    if (!Number.isFinite(n)) return;
    onWeightChange(unit === 'kg' ? n : lbToKg(n));
  };
  return (
    <View className="gap-6">
      <StepHeading
        title="What do you weigh now?"
        subtitle="This is your starting weight — we'll log it."
      />
      <UnitToggle
        value={unit}
        options={[
          { value: 'kg', label: 'kg' },
          { value: 'lb', label: 'lb' },
        ]}
        onChange={handleUnitChange}
      />
      <LabeledInput
        label={`Weight (${unit})`}
        value={text}
        onChangeText={handleTextChange}
        keyboardType="decimal-pad"
        maxLength={5}
      />
    </View>
  );
}
