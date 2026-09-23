import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AdminLogDetail } from '../../../shared/api';
import { ApiClientError, api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { sourceLabel } from '../../config/languages';
import { format, type ClientErrorCode } from '../../i18n/dictionaries';
import { useI18n } from '../../i18n/I18nContext';
import { formatDuration, formatNumber, formatUsd } from '../../lib/format';
import { ResultStack } from '../ResultStack';
import { StatusBadge } from './LogTable';

interface LogDetailDialogProps {
  id: number;
  onClose: () => void;
}

export function LogDetailDialog({ id, onClose }: LogDetailDialogProps) {
  const { withSession } = useAuth();
  const { lang, locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<AdminLogDetail | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    withSession((token) => api.adminLog(token, id))
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.code : 'internal_error');
      });
    return () => {
      cancelled = true;
    };
  }, [id, withSession]);

  const label = (source: string | null) =>
    source === null
      ? t.notAvailable
      : source === 'auto'
        ? t.autoDetect
        : sourceLabel(source, lang, true);

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="log-detail-title"
      onClose={onClose}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}
    >
      <div className="dialog__body">
        <div className="dialog__header">
          <h2 id="log-detail-title" className="panel__title">
            {format(t.logDetail, { id })}
          </h2>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => dialogRef.current?.close()}
          >
            {t.close}
          </button>
        </div>

        {error && (
          <p className="alert" role="alert">
            {t.errors[error]}
          </p>
        )}
        {!detail && !error && <p className="muted">{t.loading}</p>}

        {detail && (
          <>
            <dl className="detail-grid">
              <Item term={t.colStatus}>
                <StatusBadge status={detail.status} />
              </Item>
              <Item term={t.timestampUtc}>
                <code>{detail.createdAt}</code>
              </Item>
              <Item term={t.colUser}>{detail.username}</Item>
              <Item term={t.duration}>{formatDuration(detail.durationMs, locale)}</Item>
              <Item term={t.selectedSource}>{label(detail.sourceMode)}</Item>
              <Item term={t.detectedSource}>{label(detail.detectedSource)}</Item>
              <Item term={t.colModel}>
                <code>{detail.model}</code>
              </Item>
              <Item term={t.inputTokens}>{formatNumber(detail.inputTokens, locale)}</Item>
              <Item term={t.outputTokens}>{formatNumber(detail.outputTokens, locale)}</Item>
              <Item term={t.totalTokens}>{formatNumber(detail.totalTokens, locale)}</Item>
              {detail.cachedInputTokens !== null && (
                <Item term={t.cachedInputTokens}>
                  {formatNumber(detail.cachedInputTokens, locale)}
                </Item>
              )}
              {detail.reasoningTokens !== null && (
                <Item term={t.reasoningTokens}>{formatNumber(detail.reasoningTokens, locale)}</Item>
              )}
              <Item term={t.inputCost}>{formatUsd(detail.estimatedInputCostUsd, locale)}</Item>
              <Item term={t.outputCost}>{formatUsd(detail.estimatedOutputCostUsd, locale)}</Item>
              <Item term={t.totalCost}>{formatUsd(detail.estimatedTotalCostUsd, locale)}</Item>
            </dl>

            <h3 className="detail-heading">{t.fullInput}</h3>
            <blockquote className="detail-input">{detail.inputText}</blockquote>

            {(detail.errorCode || detail.errorMessage) && (
              <>
                <h3 className="detail-heading">{t.failureInfo}</h3>
                <p className="alert">
                  <code>{detail.errorCode}</code>
                  {detail.errorMessage && (
                    <>
                      {' '}
                      — <code>{detail.errorMessage}</code>
                    </>
                  )}
                </p>
              </>
            )}

            <h3 className="detail-heading">{t.storedOutput}</h3>
            {detail.response ? (
              <ResultStack result={detail.response} idPrefix={`log-${detail.id}`} />
            ) : (
              <p className="muted">{t.noStoredOutput}</p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

function Item({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="detail-grid__item">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
