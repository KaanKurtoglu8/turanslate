import { describe, expect, it } from 'vitest';
import { PBKDF2_ITERATIONS, hashPassword, verifyPassword } from '../src/auth/password';
import { readConfig } from '../src/env';
import { estimateCost } from '../src/pricing';
import { RESULT_SCHEMA } from '../src/translation/schema';
import { validateModelOutput } from '../src/translation/validate';
import { sampleResult } from './fixtures';

describe('password hashing', () => {
  it('salts every hash and verifies only the right password', async () => {
    const a = await hashPassword('correct horse');
    const b = await hashPassword('correct horse');
    expect(a).not.toBe(b);
    expect(a.startsWith(`pbkdf2_sha256$${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(a).not.toContain('correct horse');
    expect(await verifyPassword('correct horse', a)).toBe(true);
    expect(await verifyPassword('correct horsE', a)).toBe(false);
    expect(await verifyPassword('correct horse', 'garbage')).toBe(false);
  });
});

describe('model output validation', () => {
  it('accepts a complete result and trims strings', () => {
    const raw = sampleResult('uz-south');
    raw.common.latin = `  ${raw.common.latin}  `;
    const outcome = validateModelOutput(raw, 'auto');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.detectedSource).toBe('uz-south');
      expect(outcome.result.common.latin).toBe('Bügün hava öte yaxşı.');
    }
  });

  it('drops unexpected native lines for Latin-only languages', () => {
    const raw = sampleResult() as unknown as { translations: Record<string, object> };
    raw.translations.tr = { latin: 'Merhaba', native: 'x' };
    const outcome = validateModelOutput(raw, 'auto');
    expect(outcome.ok && outcome.result.translations.tr).toEqual({ latin: 'Merhaba' });
  });

  /** Loosely typed view of a result, so tests can break it in arbitrary ways. */
  type Loose = {
    detectedSource?: string;
    translations: Record<string, Record<string, string>>;
    common?: Record<string, string>;
  };

  it.each([
    ['invalid_detected_source', (r: Loose) => (r.detectedSource = 'crh')],
    ['missing_translation_tt', (r: Loose) => delete r.translations.tt],
    ['missing_latin_az', (r: Loose) => (r.translations.az!.latin = '   ')],
    ['missing_native_ug', (r: Loose) => (r.translations.ug!.native = '')],
    ['missing_common', (r: Loose) => delete r.common],
    ['common_not_latin', (r: Loose) => (r.common!.latin = 'Бүгүн hava')],
    ['common_not_latin', (r: Loose) => (r.common!.latin = 'بۈگۈن')],
  ])('rejects %s', (reason, mutate) => {
    const raw = sampleResult() as unknown as Loose;
    mutate(raw);
    const outcome = validateModelOutput(raw, 'auto');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.reason).toBe(reason);
  });

  it('rejects non-objects', () => {
    expect(validateModelOutput('nope', 'auto').ok).toBe(false);
    expect(validateModelOutput(null, 'auto').ok).toBe(false);
  });
});

describe('structured output schema', () => {
  it('requires every language in the fixed order and native lines where needed', () => {
    const translations = RESULT_SCHEMA.properties.translations;
    expect(translations.required).toEqual(['tr', 'az', 'tk', 'uz', 'ug', 'ky', 'kk', 'tt']);
    const props = translations.properties as Record<string, { required: string[] }>;
    expect(props.ug!.required).toEqual(['latin', 'native']);
    expect(props.tr!.required).toEqual(['latin']);
  });
});

describe('pricing', () => {
  it('prices input and output separately', () => {
    const cost = estimateCost(
      {
        inputTokens: 2_000,
        outputTokens: 1_000,
        totalTokens: 3_000,
        cachedInputTokens: null,
        reasoningTokens: null,
      },
      { inputUsdPer1M: 2, outputUsdPer1M: 10 },
    );
    expect(cost.inputUsd).toBeCloseTo(0.004, 12);
    expect(cost.outputUsd).toBeCloseTo(0.01, 12);
    expect(cost.totalUsd).toBeCloseTo(0.014, 12);
  });

  it('returns nulls when pricing or usage is unknown', () => {
    expect(estimateCost(null, { inputUsdPer1M: 1, outputUsdPer1M: 1 }).totalUsd).toBeNull();
    const usage = {
      inputTokens: 1,
      outputTokens: 1,
      totalTokens: 2,
      cachedInputTokens: null,
      reasoningTokens: null,
    };
    expect(estimateCost(usage, null)).toEqual({ inputUsd: null, outputUsd: null, totalUsd: null });
  });

  it('reads pricing only when both prices are configured', () => {
    const base = { DB: {} as D1Database };
    expect(readConfig({ ...base, OPENAI_INPUT_USD_PER_1M: '2' }).pricing).toBeNull();
    expect(
      readConfig({ ...base, OPENAI_INPUT_USD_PER_1M: '2', OPENAI_OUTPUT_USD_PER_1M: '10' }).pricing,
    ).toEqual({ inputUsdPer1M: 2, outputUsdPer1M: 10 });
  });
});
