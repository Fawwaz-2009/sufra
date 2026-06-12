import { I18nManager } from 'react-native';

import { getLocale } from './locale';

/**
 * Direction is BOOT state (frontend-expo.md "RTL", mined from the radeef spike): I18nManager flags
 * only take effect on the next launch, so this module runs as a SIDE EFFECT — imported FIRST in the
 * root app/_layout.tsx, before any view lays out. The stored-Locale read is synchronous.
 *
 * First launch on an Arabic device renders RTL from frame one via app.json's
 * `extra.supportsRTL` (the expo-localization plugin); this module then keeps the persisted native
 * flag in lockstep with the chosen Locale (an explicit switch reloads — see the Language row).
 */
I18nManager.allowRTL(true);
const wantRTL = getLocale() === 'ar';
if (I18nManager.isRTL !== wantRTL) {
  I18nManager.forceRTL(wantRTL);
}
