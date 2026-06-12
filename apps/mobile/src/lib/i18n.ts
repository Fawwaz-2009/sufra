// Hermes lacks Intl.Locale / Intl.PluralRules (Lingui's RN requirements); polyfill-force skips
// runtime feature-detection (slow on low-end devices).
import '@formatjs/intl-locale/polyfill-force.js';
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/ar.js';

import { i18n } from '@lingui/core';

import { getLocale } from '@/lib/locale';
import { messages as ar } from '@/locales/ar/messages';
import { messages as en } from '@/locales/en/messages';

i18n.load({ en, ar });
// The Locale is boot state, like direction (lib/rtl.ts): activated once from the stored/device
// Locale before the first render; a switch reloads the app rather than re-activating live.
i18n.activate(getLocale());

export { i18n };
