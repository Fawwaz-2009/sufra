import { useState } from 'react';
import { View } from 'react-native';

import { LabeledInput } from '@/components/labeled-input';

/**
 * The native birthday entry — Day / Month / Year numeric fields assembling the same `YYYY-MM-DD` the
 * web's <input type="date"> sends (a calendar picker would mean a new native module — a dev-client
 * rebuild). Emits the assembled string when all three fields have content, '' otherwise; calendar
 * validity (a real date, not future, within 110 years) is the caller's check via `isValidBirthday`.
 * Shared by the onboarding birthday step and the Settings birthday sheet.
 */
export function BirthdayFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [y = '', m = '', d = ''] = value.split('-');
  const [year, setYear] = useState(y);
  const [month, setMonth] = useState(m === '' ? '' : String(Number(m)));
  const [day, setDay] = useState(d === '' ? '' : String(Number(d)));

  const emit = (yy: string, mm: string, dd: string) => {
    if (yy.length === 4 && mm.length >= 1 && dd.length >= 1) {
      onChange(`${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
    } else {
      onChange('');
    }
  };

  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <LabeledInput
          label="Day"
          value={day}
          onChangeText={(v) => {
            setDay(v);
            emit(year, month, v);
          }}
          placeholder="17"
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
      <View className="flex-1">
        <LabeledInput
          label="Month"
          value={month}
          onChangeText={(v) => {
            setMonth(v);
            emit(year, v, day);
          }}
          placeholder="3"
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
      <View className="flex-1">
        <LabeledInput
          label="Year"
          value={year}
          onChangeText={(v) => {
            setYear(v);
            emit(v, month, day);
          }}
          placeholder="1990"
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );
}
