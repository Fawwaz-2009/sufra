import { View } from 'react-native';

import { cmToImperial, imperialToCm } from '@/lib/units';
import { LabeledInput } from '@/components/labeled-input';
import { StepHeading } from './step-heading';
import { UnitToggle } from '@/components/unit-toggle';

export function StepHeight({
  heightCm,
  unit,
  onHeightChange,
  onUnitChange,
}: {
  heightCm: number | null;
  unit: 'cm' | 'imperial';
  onHeightChange: (cm: number) => void;
  onUnitChange: (u: 'cm' | 'imperial') => void;
}) {
  return (
    <View className="gap-6">
      <StepHeading title="How tall are you?" />
      <UnitToggle
        value={unit}
        options={[
          { value: 'cm', label: 'cm' },
          { value: 'imperial', label: 'ft + in' },
        ]}
        onChange={onUnitChange}
      />
      {unit === 'cm' ? (
        <LabeledInput
          label="Height (cm)"
          defaultValue={heightCm != null ? String(heightCm) : ''}
          onChangeText={(v) => {
            if (v === '') return;
            const n = Number(v);
            if (Number.isFinite(n)) onHeightChange(Math.round(n));
          }}
          keyboardType="number-pad"
          maxLength={3}
        />
      ) : (
        <ImperialHeightInput heightCm={heightCm} onChange={onHeightChange} />
      )}
    </View>
  );
}

function ImperialHeightInput({
  heightCm,
  onChange,
}: {
  heightCm: number | null;
  onChange: (cm: number) => void;
}) {
  const display = heightCm != null ? cmToImperial(heightCm) : { feet: 0, inches: 0 };
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <LabeledInput
          label="Feet"
          value={heightCm != null ? String(display.feet) : ''}
          onChangeText={(v) => {
            const n = Number(v);
            if (Number.isFinite(n)) onChange(imperialToCm(n, display.inches));
          }}
          keyboardType="number-pad"
          maxLength={1}
        />
      </View>
      <View className="flex-1">
        <LabeledInput
          label="Inches"
          value={heightCm != null ? String(display.inches) : ''}
          onChangeText={(v) => {
            const n = Number(v);
            if (Number.isFinite(n)) onChange(imperialToCm(display.feet, n));
          }}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
    </View>
  );
}
