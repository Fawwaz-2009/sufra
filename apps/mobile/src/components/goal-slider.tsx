import { t } from '@lingui/core/macro';
import { useMemo, useState } from 'react';
import { PanResponder, View } from 'react-native';

import { Palette } from '@/constants/theme';

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 8;
const SLIDER_HEIGHT = 40;

/**
 * A pure-JS slider for the goal weight (the web's <input type="range">) — RN core has no <Slider>
 * and the community one is a native module (a dev-client rebuild), so the track is a PanResponder.
 * Shared by the onboarding goal step and the Profile goal sheet.
 *
 * Absolute positioning: the value tracks the finger's position on the track, on tap AND drag — so
 * there is no gesture-session state at all. The fill/thumb children are pointerEvents="none", which
 * keeps every touch landing on this container and `locationX` relative to it.
 */
export function GoalSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(0);

  // Recreated when onChange's identity changes (every parent render) — PanResponder.create is cheap.
  const responder = useMemo(() => {
    const kgPerPx = width > 0 ? (max - min) / width : 0;
    const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v)));
    const valueAt = (locationX: number) => clamp(min + locationX * kgPerPx);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(valueAt(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChange(valueAt(e.nativeEvent.locationX)),
    });
  }, [width, min, max, onChange]);

  const ratio = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;

  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: SLIDER_HEIGHT, justifyContent: 'center' }}
      accessibilityLabel={t`Goal weight`}>
      <View
        pointerEvents="none"
        className="rounded-[9999px] bg-track"
        style={{ height: TRACK_HEIGHT }}
      />
      <View
        pointerEvents="none"
        className="absolute rounded-[9999px]"
        style={{
          height: TRACK_HEIGHT,
          top: (SLIDER_HEIGHT - TRACK_HEIGHT) / 2,
          width: ratio * width,
          backgroundColor: Palette.flame,
        }}
      />
      <View
        pointerEvents="none"
        className="absolute border-2 border-flame bg-white"
        style={{
          height: THUMB_SIZE,
          width: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          top: (SLIDER_HEIGHT - THUMB_SIZE) / 2,
          left: Math.max(0, ratio * (width - THUMB_SIZE)),
        }}
      />
    </View>
  );
}
