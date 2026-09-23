import { describe, expect, it } from 'vitest';
import { SOURCE_IDS } from '../../shared/languages';
import { DICTIONARIES } from '../i18n/dictionaries';
import { FAMILIES, LANGUAGES, REGIONAL_OPTIONS, sourceFlag, sourceLabel } from './languages';

describe('language metadata', () => {
  it('keeps the fixed output order', () => {
    expect(LANGUAGES.map((l) => l.id)).toEqual(['tr', 'az', 'tk', 'uz', 'ug', 'ky', 'kk', 'tt']);
    expect(LANGUAGES.map((l) => l.outputOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('groups families as Oghuz, Karluk, Kipchak', () => {
    expect(FAMILIES.map((f) => [f.id, f.languages.map((l) => l.id)])).toEqual([
      ['oghuz', ['tr', 'az', 'tk']],
      ['karluk', ['uz', 'ug']],
      ['kipchak', ['ky', 'kk', 'tt']],
    ]);
    expect(FAMILIES.map((f) => f.labels.tr)).toEqual([
      'Oğuz grubu',
      'Karluk grubu',
      'Kıpçak grubu',
    ]);
  });

  it('uses the required UI labels', () => {
    const uz = LANGUAGES.find((l) => l.id === 'uz')!;
    expect(uz.labels).toEqual({ tr: 'Özbekçe', en: 'Uzbek' });
    expect(LANGUAGES.map((l) => l.labels.tr)).toEqual([
      'Türkiye Türkçesi',
      'Azerbaycan Türkçesi',
      'Türkmence',
      'Özbekçe',
      'Uygurca',
      'Kırgızca',
      'Kazakça',
      'Tatarca',
    ]);
  });

  it('requires native lines exactly for ug, ky, kk, tt; Uyghur is RTL', () => {
    expect(LANGUAGES.filter((l) => l.requiresNativeLine).map((l) => l.id)).toEqual([
      'ug',
      'ky',
      'kk',
      'tt',
    ]);
    expect(LANGUAGES.find((l) => l.id === 'ug')!.nativeScript).toEqual({
      lang: 'ug-Arab',
      dir: 'rtl',
    });
  });

  it('resolves a local flag for every language and variant', () => {
    for (const language of LANGUAGES) expect(language.flagPath, language.id).toBeTruthy();
    expect(sourceFlag('az-south')).toBe(sourceFlag('az'));
    expect(sourceFlag('uz-south')).toBe(sourceFlag('uz'));
  });

  it('offers every source id in the selector', () => {
    const regional = Object.values(REGIONAL_OPTIONS).flatMap((options) =>
      options!.map((o) => o.sourceId),
    );
    const plain = LANGUAGES.filter((l) => !REGIONAL_OPTIONS[l.id]).map((l) => l.id);
    expect(new Set([...regional, ...plain])).toEqual(new Set(SOURCE_IDS));
  });

  it('labels variants beneath their parent', () => {
    expect(sourceLabel('az-south', 'tr')).toBe('Azerbaycan Türkçesi (Güney)');
    expect(sourceLabel('uz-south', 'en')).toBe('Uzbek (South / Afghanistan)');
    expect(sourceLabel('az', 'tr')).toBe('Azerbaycan Türkçesi');
    expect(sourceLabel('az', 'en', true)).toBe('Azerbaijani (North / standard)');
    expect(sourceLabel('kk', 'tr')).toBe('Kazakça');
  });
});

describe('i18n dictionaries', () => {
  it('have identical keys in TR and EN', () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, v]) =>
        typeof v === 'object' ? keys(v).map((k) => `${key}.${k}`) : [key],
      );
    expect(keys(DICTIONARIES.en).sort()).toEqual(keys(DICTIONARIES.tr).sort());
  });

  it('contain the required core strings', () => {
    expect(DICTIONARIES.tr).toMatchObject({
      username: 'Kullanıcı adı',
      password: 'Şifre',
      signIn: 'Giriş yap',
      signOut: 'Çıkış yap',
      autoDetect: 'Otomatik algıla',
      translate: 'Çevir',
      change: 'Değiştir',
      sourceBadge: 'Kaynak',
      admin: 'Yönetim',
      sharedTitle: 'Ortak Türkçe',
      sharedSubtitle: 'Deneysel ortak biçim',
      detectedAs: '{language} olarak algılandı',
    });
    expect(DICTIONARIES.en).toMatchObject({
      sharedTitle: 'Shared Turkic',
      sharedSubtitle: 'Experimental shared form',
      detectedAs: 'Detected as {language}',
    });
  });
});
