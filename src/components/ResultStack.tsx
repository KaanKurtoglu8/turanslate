/**
 * The core comparison: eight languages in fixed order inside three family cards,
 * then the separately styled Shared Turkic card.
 */
import type { CSSProperties } from 'react';
import type { TranslationResult } from '../../shared/api';
import { baseLanguageOf, isSourceId } from '../../shared/languages';
import { FAMILIES, type LanguageConfig } from '../config/languages';
import { useI18n } from '../i18n/I18nContext';
import { Flag } from './Flag';

interface ResultStackProps {
  result: TranslationResult;
  /** Prefix for element ids, so two stacks can coexist on a page. */
  idPrefix?: string;
}

export function ResultStack({ result, idPrefix = 'result' }: ResultStackProps) {
  const { lang, t } = useI18n();
  const highlighted = isSourceId(result.detectedSource)
    ? baseLanguageOf(result.detectedSource)
    : null;

  return (
    <div className="results">
      {FAMILIES.map((family) => {
        const headingId = `${idPrefix}-family-${family.id}`;
        const style = {
          '--card-bg': family.background,
          '--card-border': family.borderColor,
        } as CSSProperties;
        return (
          <section
            key={family.id}
            className="family-card"
            style={style}
            aria-labelledby={headingId}
          >
            <h3 id={headingId} className="family-card__title">
              {family.labels[lang]}
            </h3>
            <ul className="family-card__rows">
              {family.languages.map((language) => (
                <LanguageRow
                  key={language.id}
                  language={language}
                  result={result}
                  isSource={language.id === highlighted}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <section className="shared-card" aria-labelledby={`${idPrefix}-shared`}>
        <div className="shared-card__head">
          <h3 id={`${idPrefix}-shared`} className="shared-card__title">
            {t.sharedTitle}
          </h3>
          <p className="shared-card__subtitle">{t.sharedSubtitle}</p>
        </div>
        <p className="shared-card__latin" lang="trk">
          {result.common.latin}
        </p>
        <p className="shared-card__note">{t.sharedNote}</p>
      </section>
    </div>
  );
}

interface LanguageRowProps {
  language: LanguageConfig;
  result: TranslationResult;
  isSource: boolean;
}

function LanguageRow({ language, result, isSource }: LanguageRowProps) {
  const { lang, t } = useI18n();
  const line = result.translations[language.id];
  const native = 'native' in line ? line.native : null;

  return (
    <li className={isSource ? 'lang-row lang-row--source' : 'lang-row'}>
      <div className="lang-row__head">
        <Flag src={language.flagPath} code={language.id} />
        <span className="lang-row__name">{language.labels[lang]}</span>
        {isSource && <span className="badge badge--source">{t.sourceBadge}</span>}
      </div>
      <p className="lang-row__latin" lang={language.id === 'tr' ? 'tr' : `${language.id}-Latn`}>
        {line.latin}
      </p>
      {native && language.nativeScript && (
        <p
          className="lang-row__native"
          lang={language.nativeScript.lang}
          dir={language.nativeScript.dir}
        >
          {native}
        </p>
      )}
    </li>
  );
}
