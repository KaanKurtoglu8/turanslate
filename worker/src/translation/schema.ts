/** Strict JSON Schema for the structured model output (mirrors `TranslationResult`). */
import { LANGUAGE_IDS, SOURCE_IDS, requiresNativeLine } from '../../../shared/languages';

function line(withNative: boolean) {
  return withNative
    ? {
        type: 'object',
        properties: { latin: { type: 'string' }, native: { type: 'string' } },
        required: ['latin', 'native'],
        additionalProperties: false,
      }
    : {
        type: 'object',
        properties: { latin: { type: 'string' } },
        required: ['latin'],
        additionalProperties: false,
      };
}

export const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    detectedSource: { type: 'string', enum: [...SOURCE_IDS] },
    translations: {
      type: 'object',
      properties: Object.fromEntries(LANGUAGE_IDS.map((id) => [id, line(requiresNativeLine(id))])),
      required: [...LANGUAGE_IDS],
      additionalProperties: false,
    },
    common: line(false),
  },
  required: ['detectedSource', 'translations', 'common'],
  additionalProperties: false,
} as const;
