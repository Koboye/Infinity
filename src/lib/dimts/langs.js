// Languages Dimts can work with. Mirrors worker/dubber/converse.py LANGS (keep in sync).
export const DIMTS_LANGS = [
  { code: 'am', name: 'Amharic', native: 'አማርኛ', bcp47: 'am-ET' },
  { code: 'om', name: 'Oromo', native: 'Afaan Oromoo', bcp47: 'om-ET' },
  { code: 'ti', name: 'Tigrinya', native: 'ትግርኛ', bcp47: 'ti-ET' },
  { code: 'en', name: 'English', native: 'English', bcp47: 'en-US' },
  { code: 'ar', name: 'Arabic', native: 'العربية', bcp47: 'ar-SA' },
  { code: 'it', name: 'Italian', native: 'Italiano', bcp47: 'it-IT' },
  { code: 'fr', name: 'French', native: 'Français', bcp47: 'fr-FR' },
  { code: 'es', name: 'Spanish', native: 'Español', bcp47: 'es-ES' },
  { code: 'de', name: 'German', native: 'Deutsch', bcp47: 'de-DE' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe', bcp47: 'tr-TR' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', bcp47: 'sw-KE' },
];
export const isLang = (c) => DIMTS_LANGS.some((l) => l.code === c);
