/**
 * Centralized UI metadata for languages, input variants and families.
 * Components must read labels, flags and family colors from here, never hard-code them.
 */
import {
  LANGUAGE_FAMILY,
  LANGUAGE_IDS,
  VARIANT_PARENT,
  isLanguageId,
  isSourceId,
  requiresNativeLine,
  type FamilyId,
  type LanguageId,
  type SourceId,
  type VariantId,
} from '../../shared/languages';

export type UiLang = 'tr' | 'en';
export type Localized = Record<UiLang, string>;

// Vite fingerprints each flag and prefixes the /turanslate/ base automatically.
// A missing file simply has no entry here; <Flag> then renders a text fallback.
const FLAG_URLS = import.meta.glob<string>('/flags/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

function flagUrl(code: string): string | undefined {
  return FLAG_URLS[`/flags/${code}.svg`];
}

export interface NativeScript {
  /** BCP 47 tag of the native-script line, e.g. `ug-Arab`. */
  lang: string;
  dir: 'ltr' | 'rtl';
}

export interface LanguageConfig {
  id: LanguageId;
  labels: Localized;
  family: FamilyId;
  flagPath: string | undefined;
  requiresNativeLine: boolean;
  nativeScript: NativeScript | null;
  /** 1-based position in the fixed comparison order. */
  outputOrder: number;
}

const LABELS: Record<LanguageId, Localized> = {
  tr: { tr: 'Türkiye Türkçesi', en: 'Türkiye Turkish' },
  az: { tr: 'Azerbaycan Türkçesi', en: 'Azerbaijani' },
  tk: { tr: 'Türkmence', en: 'Turkmen' },
  uz: { tr: 'Özbekçe', en: 'Uzbek' },
  ug: { tr: 'Uygurca', en: 'Uyghur' },
  ky: { tr: 'Kırgızca', en: 'Kyrgyz' },
  kk: { tr: 'Kazakça', en: 'Kazakh' },
  tt: { tr: 'Tatarca', en: 'Tatar' },
};

const NATIVE_SCRIPTS: Partial<Record<LanguageId, NativeScript>> = {
  ug: { lang: 'ug-Arab', dir: 'rtl' },
  ky: { lang: 'ky-Cyrl', dir: 'ltr' },
  kk: { lang: 'kk-Cyrl', dir: 'ltr' },
  tt: { lang: 'tt-Cyrl', dir: 'ltr' },
};

export const LANGUAGES: readonly LanguageConfig[] = LANGUAGE_IDS.map((id, index) => ({
  id,
  labels: LABELS[id],
  family: LANGUAGE_FAMILY[id],
  flagPath: flagUrl(id),
  requiresNativeLine: requiresNativeLine(id),
  nativeScript: NATIVE_SCRIPTS[id] ?? null,
  outputOrder: index + 1,
}));

export const LANGUAGE_BY_ID = Object.fromEntries(LANGUAGES.map((l) => [l.id, l])) as Record<
  LanguageId,
  LanguageConfig
>;

export interface FamilyConfig {
  id: FamilyId;
  labels: Localized;
  /** CSS custom properties defined in `src/styles/tokens.css`. */
  background: string;
  borderColor: string;
  languages: readonly LanguageConfig[];
}

const FAMILY_LABELS: Record<FamilyId, Localized> = {
  oghuz: { tr: 'Oğuz grubu', en: 'Oghuz group' },
  karluk: { tr: 'Karluk grubu', en: 'Karluk group' },
  kipchak: { tr: 'Kıpçak grubu', en: 'Kipchak group' },
};

export const FAMILIES: readonly FamilyConfig[] = (['oghuz', 'karluk', 'kipchak'] as const).map(
  (id) => ({
    id,
    labels: FAMILY_LABELS[id],
    background: `var(--family-${id}-bg)`,
    borderColor: `var(--family-${id}-border)`,
    languages: LANGUAGES.filter((l) => l.family === id),
  }),
);

/** Regional options shown beneath a parent language in the input selector. */
export interface RegionalOption {
  sourceId: SourceId;
  parent: LanguageId;
  labels: Localized;
}

export const REGIONAL_OPTIONS: Partial<Record<LanguageId, readonly RegionalOption[]>> = {
  az: [
    { sourceId: 'az', parent: 'az', labels: { tr: 'Kuzey / standart', en: 'North / standard' } },
    { sourceId: 'az-south', parent: 'az', labels: { tr: 'Güney', en: 'South / Iran' } },
  ],
  uz: [
    {
      sourceId: 'uz',
      parent: 'uz',
      labels: { tr: 'Özbekistan standardı', en: 'Uzbekistan standard' },
    },
    {
      sourceId: 'uz-south',
      parent: 'uz',
      labels: { tr: 'Güney / Afganistan', en: 'South / Afghanistan' },
    },
  ],
};

/** Input-only variants reuse their parent's flag unless a dedicated asset exists. */
export function sourceFlag(id: SourceId): string | undefined {
  if (isLanguageId(id)) return LANGUAGE_BY_ID[id].flagPath;
  return flagUrl(id) ?? LANGUAGE_BY_ID[VARIANT_PARENT[id as VariantId]].flagPath;
}

/**
 * Human label for a concrete source id.
 * `qualifyStandard` also names the standard option of a language with variants
 * (e.g. "Azerbaycan Türkçesi (Kuzey / standart)").
 */
export function sourceLabel(id: string, lang: UiLang, qualifyStandard = false): string {
  if (!isSourceId(id)) return id;
  const parent = isLanguageId(id) ? id : VARIANT_PARENT[id as VariantId];
  const base = LANGUAGE_BY_ID[parent].labels[lang];
  const option = REGIONAL_OPTIONS[parent]?.find((o) => o.sourceId === id);
  if (!option || (option.sourceId === parent && !qualifyStandard)) return base;
  return `${base} (${option.labels[lang]})`;
}
