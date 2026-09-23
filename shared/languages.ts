/**
 * Language identifiers shared by the frontend and the Worker.
 *
 * UI labels, flags and colors live in `src/config/`; this module only holds the
 * facts both sides must agree on.
 */

/** The eight output languages, in the fixed comparison order. */
export const LANGUAGE_IDS = ['tr', 'az', 'tk', 'uz', 'ug', 'ky', 'kk', 'tt'] as const;
export type LanguageId = (typeof LANGUAGE_IDS)[number];

export const FAMILY_IDS = ['oghuz', 'karluk', 'kipchak'] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

export const LANGUAGE_FAMILY: Record<LanguageId, FamilyId> = {
  tr: 'oghuz',
  az: 'oghuz',
  tk: 'oghuz',
  uz: 'karluk',
  ug: 'karluk',
  ky: 'kipchak',
  kk: 'kipchak',
  tt: 'kipchak',
};

/** Output languages that also get a native-script line. */
export const NATIVE_LINE_LANGUAGES = ['ug', 'ky', 'kk', 'tt'] as const;
export type NativeLineLanguageId = (typeof NATIVE_LINE_LANGUAGES)[number];

export function requiresNativeLine(id: LanguageId): id is NativeLineLanguageId {
  return (NATIVE_LINE_LANGUAGES as readonly string[]).includes(id);
}

/** Input-only regional variants (app-internal ids, not ISO codes). */
export const VARIANT_IDS = ['az-south', 'uz-south'] as const;
export type VariantId = (typeof VARIANT_IDS)[number];

export const VARIANT_PARENT: Record<VariantId, LanguageId> = {
  'az-south': 'az',
  'uz-south': 'uz',
};

/** Every concrete source a sentence can be in, in selector order. */
export const SOURCE_IDS = [
  'tr',
  'az',
  'az-south',
  'tk',
  'uz',
  'uz-south',
  'ug',
  'ky',
  'kk',
  'tt',
] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

export type SourceMode = 'auto' | SourceId;

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === 'string' && (LANGUAGE_IDS as readonly string[]).includes(value);
}

export function isSourceId(value: unknown): value is SourceId {
  return typeof value === 'string' && (SOURCE_IDS as readonly string[]).includes(value);
}

export function isSourceMode(value: unknown): value is SourceMode {
  return value === 'auto' || isSourceId(value);
}

/** The output row a source maps to (`az-south` -> `az`). */
export function baseLanguageOf(source: SourceId): LanguageId {
  return isLanguageId(source) ? source : VARIANT_PARENT[source];
}
