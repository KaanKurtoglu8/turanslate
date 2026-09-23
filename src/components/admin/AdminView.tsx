/**
 * Owner-only usage overview and query log. The Worker enforces the admin role on
 * every /admin/* call; hiding this view from normal users is only cosmetic.
 */
import { useEffect, useState } from 'react';
import type { AdminLogListItem, UsageSummaryResponse } from '../../../shared/api';
import { ApiClientError, api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { ClientErrorCode } from '../../i18n/dictionaries';
import { useI18n } from '../../i18n/I18nContext';
import { LogDetailDialog } from './LogDetailDialog';
import { LogTable } from './LogTable';
import { UsageSummary } from './UsageSummary';

const PAGE_SIZE = 25;

function codeOf(error: unknown): ClientErrorCode {
  return error instanceof ApiClientError ? error.code : 'internal_error';
}

/** One page request; a new object (even with equal fields) triggers a fetch. */
interface LogRequest {
  filter: string;
  before: number | null;
}

interface LogState {
  items: AdminLogListItem[];
  nextBefore: number | null;
  error: ClientErrorCode | null;
  /** The request these items answer; while it differs from the current one we are loading. */
  settled: LogRequest | null;
}

export function AdminView({ onBack }: { onBack: () => void }) {
  const { withSession } = useAuth();
  const { t } = useI18n();

  const [summaryRequest, setSummaryRequest] = useState(0);
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<ClientErrorCode | null>(null);

  const [logRequest, setLogRequest] = useState<LogRequest>({ filter: '', before: null });
  const [logs, setLogs] = useState<LogState>({
    items: [],
    nextBefore: null,
    error: null,
    settled: null,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    withSession((token) => api.usageSummary(token))
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setSummaryError(null);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSummaryError(codeOf(error));
      });
    return () => {
      cancelled = true;
    };
  }, [summaryRequest, withSession]);

  useEffect(() => {
    let cancelled = false;
    const request = logRequest;
    withSession((token) =>
      api.adminLogs(token, {
        username: request.filter || undefined,
        before: request.before ?? undefined,
        limit: PAGE_SIZE,
      }),
    )
      .then((page) => {
        if (cancelled) return;
        setLogs((current) => ({
          items: request.before ? [...current.items, ...page.items] : page.items,
          nextBefore: page.nextBefore,
          error: null,
          settled: request,
        }));
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLogs((current) => ({ ...current, error: codeOf(error), settled: request }));
      });
    return () => {
      cancelled = true;
    };
  }, [logRequest, withSession]);

  const logsLoading = logs.settled !== logRequest;

  function refresh() {
    setSummaryRequest((n) => n + 1);
    setLogRequest((current) => ({ filter: current.filter, before: null }));
  }

  return (
    <main className="container admin" id="main">
      <div className="admin__header">
        <h1 className="admin__title">{t.admin}</h1>
        <div className="admin__actions">
          <button type="button" className="btn btn--ghost" onClick={refresh}>
            {t.refresh}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            {t.backToTranslator}
          </button>
        </div>
      </div>

      <section className="panel" aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="panel__title">
          {t.usageSummary}
        </h2>
        {summaryError ? (
          <p className="alert" role="alert">
            {t.errors[summaryError]}
          </p>
        ) : summary ? (
          <UsageSummary summary={summary} />
        ) : (
          <p className="muted">{t.loading}</p>
        )}
      </section>

      <section className="panel" aria-labelledby="log-heading" aria-busy={logsLoading}>
        <div className="panel__header">
          <h2 id="log-heading" className="panel__title">
            {t.queryLog}
          </h2>
          <div className="field field--inline">
            <label htmlFor="log-filter">{t.filterByUser}</label>
            <select
              id="log-filter"
              value={logRequest.filter}
              onChange={(event) => setLogRequest({ filter: event.target.value, before: null })}
            >
              <option value="">{t.allUsers}</option>
              {summary?.users.map((user) => (
                <option key={user.userId} value={user.username}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>
        </div>

        {logs.error && (
          <p className="alert" role="alert">
            {t.errors[logs.error]}
          </p>
        )}
        <LogTable items={logs.items} onOpen={setSelectedId} />
        {!logsLoading && !logs.error && logs.items.length === 0 && (
          <p className="muted">{t.noLogs}</p>
        )}
        <div className="panel__footer">
          {logsLoading && <p className="muted">{t.loading}</p>}
          {!logsLoading && logs.nextBefore !== null && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setLogRequest({ filter: logRequest.filter, before: logs.nextBefore })}
            >
              {t.loadMore}
            </button>
          )}
        </div>
      </section>

      {selectedId !== null && (
        <LogDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </main>
  );
}
