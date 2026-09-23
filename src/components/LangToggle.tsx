import type { UiLang } from '../config/languages';
import { useI18n } from '../i18n/I18nContext';

const OPTIONS: readonly UiLang[] = ['tr', 'en'];

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label={t.uiLanguage}>
      {OPTIONS.map((option, index) => (
        <span key={option} className="lang-toggle__item">
          {index > 0 && (
            <span className="lang-toggle__sep" aria-hidden="true">
              |
            </span>
          )}
          <button
            type="button"
            lang={option}
            aria-pressed={lang === option}
            onClick={() => setLang(option)}
          >
            {option.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
