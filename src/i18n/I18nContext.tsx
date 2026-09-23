import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UiLang } from '../config/languages';
import { DICTIONARIES, LOCALES, type Dictionary } from './dictionaries';

interface I18nValue {
  lang: UiLang;
  locale: string;
  t: Dictionary;
  setLang: (lang: UiLang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);
const STORAGE_KEY = 'turanslate.uiLang';

function initialLang(): UiLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'tr';
  } catch {
    return 'tr';
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<UiLang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage may be unavailable (private mode); the toggle still works for this visit.
    }
  }, [lang]);

  const value = useMemo(
    () => ({ lang, locale: LOCALES[lang], t: DICTIONARIES[lang], setLang }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside <I18nProvider>');
  return value;
}
