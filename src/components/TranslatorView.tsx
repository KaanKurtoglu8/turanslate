import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_INPUT_CHARS, type TranslateResponse } from '../../shared/api';
import type { SourceMode } from '../../shared/languages';
import { ApiClientError, api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { sourceLabel } from '../config/languages';
import { format, type ClientErrorCode } from '../i18n/dictionaries';
import { useI18n } from '../i18n/I18nContext';
import { interpolate } from '../i18n/interpolate';
import { ResultStack } from './ResultStack';
import { SourceSelect, type SourceSelectHandle } from './SourceSelect';

/** Code points, matching how the Worker counts. */
function charLength(value: string): number {
  return [...value].length;
}

export function TranslatorView({ hidden }: { hidden: boolean }) {
  const { withSession } = useAuth();
  const { lang, t } = useI18n();
  const [text, setText] = useState('');
  const [source, setSource] = useState<SourceMode>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [last, setLast] = useState<TranslateResponse | null>(null);
  const selectRef = useRef<SourceSelectHandle>(null);

  async function translate() {
    if (busy) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setError('empty_input');
      return;
    }
    // Never send over-limit text; the Worker would reject it anyway.
    if (charLength(trimmed) > MAX_INPUT_CHARS) {
      setError('input_too_long');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await withSession((token) =>
        api.translate(token, { text: trimmed, source }),
      );
      setLast(response);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.code : 'internal_error');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void translate();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void translate();
    }
  }

  const detected = last?.result.detectedSource;
  const charCount = charLength(text);
  const overLimit = charLength(text.trim()) > MAX_INPUT_CHARS;

  return (
    <main className="container translator" id="main" hidden={hidden}>
      <h1 className="visually-hidden">Turanslate</h1>
      <form className="composer" onSubmit={onSubmit} aria-busy={busy}>
        <label htmlFor="sentence" className="composer__label">
          {t.inputLabel}
        </label>
        <textarea
          id="sentence"
          className="composer__input"
          rows={2}
          // UTF-16 units: never looser than the code-point limit, and it truncates pastes.
          maxLength={MAX_INPUT_CHARS}
          placeholder={t.inputPlaceholder}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (error === 'input_too_long' || error === 'empty_input') setError(null);
          }}
          onKeyDown={onKeyDown}
          aria-describedby="sentence-hint"
          aria-invalid={overLimit || error === 'empty_input' || error === 'input_too_long'}
        />
        <div className="composer__meta" id="sentence-hint">
          <span>{t.inputHint}</span>
          <span className={overLimit ? 'composer__count is-over' : 'composer__count'}>
            {format(t.charCount, { count: charCount, max: MAX_INPUT_CHARS })}
          </span>
        </div>
        <div className="composer__controls">
          <div className="composer__source">
            <span id="source-label" className="composer__label composer__label--small">
              {t.sourceLanguage}
            </span>
            <SourceSelect
              ref={selectRef}
              value={source}
              onChange={setSource}
              labelId="source-label"
              disabled={busy}
            />
          </div>
          <button
            type="submit"
            className="btn btn--primary composer__submit"
            disabled={busy || overLimit}
          >
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? t.translating : t.translate}
          </button>
        </div>
      </form>

      <div className="status-area" aria-live="polite">
        {error && (
          <p className="alert" role="alert">
            {t.errors[error]}
          </p>
        )}
        {last && detected && !busy && (
          <p className="detect-status">
            <span>
              {interpolate(last.sourceMode === 'auto' ? t.detectedAs : t.sourceIs, {
                language: <strong>{sourceLabel(detected, lang)}</strong>,
              })}
            </span>
            <span aria-hidden="true"> · </span>
            <button type="button" className="link-button" onClick={() => selectRef.current?.open()}>
              {t.change}
            </button>
          </p>
        )}
        {busy && <p className="visually-hidden">{t.translating}</p>}
      </div>

      <section
        aria-label={t.resultsHeading}
        className={busy ? 'results-wrap is-busy' : 'results-wrap'}
      >
        {last ? (
          <ResultStack result={last.result} />
        ) : (
          <p className="empty-state">{t.emptyState}</p>
        )}
      </section>
    </main>
  );
}
