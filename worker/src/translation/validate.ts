/**
 * Validates untrusted model output into a `TranslationResult`. Nothing reaches the
 * browser (or `response_json`) without passing through here.
 */
import type { TranslationResult, TranslationSet } from '../../../shared/api';
import {
  LANGUAGE_IDS,
  isSourceId,
  requiresNativeLine,
  type SourceMode,
} from '../../../shared/languages';

const MAX_LINE_CHARS = 2000;
const NON_LATIN_SCRIPT = /[\p{Script=Cyrillic}\p{Script=Arabic}]/u;

export type ValidationResult =
  | { ok: true; result: TranslationResult; modelDetectedSource: string }
  | { ok: false; reason: string; modelDetectedSource: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_LINE_CHARS ? trimmed : null;
}

export function validateModelOutput(raw: unknown, sourceMode: SourceMode): ValidationResult {
  if (!isRecord(raw)) return { ok: false, reason: 'not_an_object', modelDetectedSource: null };

  const modelDetected = typeof raw.detectedSource === 'string' ? raw.detectedSource : null;
  const fail = (reason: string): ValidationResult => ({
    ok: false,
    reason,
    modelDetectedSource: modelDetected,
  });

  if (!isSourceId(modelDetected)) return fail('invalid_detected_source');
  if (!isRecord(raw.translations)) return fail('missing_translations');

  const translations: Partial<Record<string, { latin: string; native?: string }>> = {};
  for (const id of LANGUAGE_IDS) {
    const entry = raw.translations[id];
    if (!isRecord(entry)) return fail(`missing_translation_${id}`);
    const latin = text(entry.latin);
    if (!latin) return fail(`missing_latin_${id}`);
    if (requiresNativeLine(id)) {
      const native = text(entry.native);
      if (!native) return fail(`missing_native_${id}`);
      translations[id] = { latin, native };
    } else {
      translations[id] = { latin };
    }
  }

  if (!isRecord(raw.common)) return fail('missing_common');
  const common = text(raw.common.latin);
  if (!common) return fail('missing_common_latin');
  if (NON_LATIN_SCRIPT.test(common)) return fail('common_not_latin');

  return {
    ok: true,
    modelDetectedSource: modelDetected,
    result: {
      // An explicit user choice always wins over the model's echo.
      detectedSource: sourceMode === 'auto' ? modelDetected : sourceMode,
      translations: translations as TranslationSet,
      common: { latin: common },
    },
  };
}
