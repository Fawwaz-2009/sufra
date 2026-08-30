import { I18nManager } from 'react-native';

/**
 * Layout direction follows the DEVICE/OS language. The in-app Language toggle was removed: a switch
 * can't reliably re-apply direction at runtime — RN's New Architecture governs LTR/RTL from the OS
 * language at native launch, and runtime `forceRTL`/`allowRTL` overrides don't take effect until a
 * full relaunch (if at all). So there is nothing to switch in-app — an Arabic-language device gets
 * RTL, an English device gets LTR, automatically.
 *
 * Imported FIRST in the root app/_layout.tsx (before any view lays out). It only ALLOWS RTL so an
 * Arabic device renders RTL from frame one (paired with app.json `extra.supportsRTL`) and clears any
 * stale forced override — `allowRTL(true) + forceRTL(false)` ⇒ isRTL follows the device.
 */
I18nManager.allowRTL(true);
I18nManager.forceRTL(false);
