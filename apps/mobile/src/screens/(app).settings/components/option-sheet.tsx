import { BottomSheet, Column, ListItem, Text as NativeText } from '@expo/ui';

/**
 * A native single-select sheet (universal `BottomSheet` + `ListItem` rows) for Settings'
 * single-tap fields (Sex, Activity). Selection commits immediately — the caller's `onSelect`
 * fires the inline profile patch and closes the sheet. The universal BottomSheet carries its
 * own `Host`, so this renders as an RN-tree sibling of the FieldGroup, not inside it.
 */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly { value: T; label: string; description?: string }[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet isPresented={visible} onDismiss={onClose}>
      <Column>
        <NativeText
          textStyle={{ fontSize: 18, fontWeight: '600' }}
          style={{ paddingBottom: 8, paddingLeft: 16 }}>
          {title}
        </NativeText>
        {options.map((option) => (
          <ListItem
            key={option.value}
            onPress={() => onSelect(option.value)}
            supportingText={option.description}
            trailing={selected === option.value ? '✓' : undefined}>
            {option.label}
          </ListItem>
        ))}
      </Column>
    </BottomSheet>
  );
}
