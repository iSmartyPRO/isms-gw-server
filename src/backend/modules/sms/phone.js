import { parsePhoneNumberFromString } from 'libphonenumber-js';

/*
 * Phone numbers and SMS length — pure helpers shared by the API, the
 * dispatcher and the tests.
 */

/** Short service numbers (operators, banks): 3–6 digits, sent as they are. */
const SHORT_CODE = /^\d{3,6}$/;

/**
 * One recipient → `{ ok: true, phone: '+996555123456', country: 'KG' }` or
 * `{ ok: false, input, reason }`. A local number needs the default country
 * (ISO 3166 alpha-2, e.g. 'KG'); international ones may start with + or 00.
 */
export function normalizePhone(input, defaultCountry = '') {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, input: raw, reason: 'EMPTY' };
  const compact = raw.replace(/[\s().-]/g, '');
  if (SHORT_CODE.test(compact)) return { ok: true, phone: compact, country: null, short: true };
  if (!/^\+?\d{6,17}$/.test(compact.replace(/^00/, '+'))) return { ok: false, input: raw, reason: 'FORMAT' };
  const international = compact.startsWith('+') || compact.startsWith('00');
  const text = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;
  const country = /^[A-Z]{2}$/.test(String(defaultCountry || '').toUpperCase()) ? String(defaultCountry).toUpperCase() : undefined;
  if (!international && !country) {
    // Without a default country a number must be international; try it as such.
    const guess = parsePhoneNumberFromString(`+${text}`);
    if (guess?.isPossible()) return { ok: true, phone: guess.number, country: guess.country || null };
    return { ok: false, input: raw, reason: 'COUNTRY' };
  }
  const parsed = parsePhoneNumberFromString(text, country);
  if (!parsed || !parsed.isPossible()) return { ok: false, input: raw, reason: 'INVALID' };
  return { ok: true, phone: parsed.number, country: parsed.country || null };
}

/**
 * Recipients from a string (comma, semicolon, new line) or an array.
 * Duplicates are dropped; the order is kept.
 */
export function parseRecipients(value, defaultCountry = '', max = 1000) {
  const items = (Array.isArray(value) ? value : String(value ?? '').split(/[\n,;]+/))
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  const seen = new Set();
  for (const item of items) {
    const result = normalizePhone(item, defaultCountry);
    if (!result.ok) {
      invalid.push({ input: result.input, reason: result.reason });
      continue;
    }
    if (seen.has(result.phone)) continue;
    seen.add(result.phone);
    valid.push(result.phone);
  }
  return { valid: valid.slice(0, max), invalid, truncated: valid.length > max };
}

// GSM 03.38 default alphabet and its extension table (an extension char costs two septets).
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const GSM_EXTENDED = new Set('^{}\\[~]|€\f');

/**
 * How the phone will split a text: encoding, characters counted, parts and
 * what is left in the last part.
 *   GSM-7: 160 per single SMS, 153 per part of a long one
 *   UCS-2: 70 per single SMS, 67 per part (any character outside GSM-7, e.g. Cyrillic, emoji)
 */
export function smsSegments(text) {
  const value = String(text ?? '');
  let septets = 0;
  let gsm = true;
  for (const char of value) {
    if (GSM_BASIC.has(char)) septets += 1;
    else if (GSM_EXTENDED.has(char)) septets += 2;
    else {
      gsm = false;
      break;
    }
  }
  if (gsm) {
    const parts = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
    const per = parts > 1 ? 153 : 160;
    return { encoding: 'GSM-7', length: septets, parts, perPart: per, remaining: parts === 0 ? 160 : parts * per - septets };
  }
  // UCS-2 counts UTF-16 code units: an emoji outside the BMP takes two.
  const units = value.length;
  const parts = units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67);
  const per = parts > 1 ? 67 : 70;
  return { encoding: 'UCS-2', length: units, parts, perPart: per, remaining: parts * per - units };
}
