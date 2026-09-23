import type { AdminLogListItem, LogStatus } from '../../../shared/api';
import { sourceLabel } from '../../config/languages';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateTime, formatNumber, formatUsd } from '../../lib/format';

export function StatusBadge({ status }: { status: LogStatus }) {
  const { t } = useI18n();
  const label = { success: t.statusSuccess, failure: t.statusFailure, pending: t.statusPending }[
    status
  ];
  return <span className={`badge badge--status badge--${status}`}>{label}</span>;
}

interface LogTableProps {
  items: AdminLogListItem[];
  onOpen: (id: number) => void;
}

export function LogTable({ items, onOpen }: LogTableProps) {
  const { lang, locale, t } = useI18n();
  if (items.length === 0) return null;

  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="log-heading">
      <table className="data-table data-table--logs">
        <thead>
          <tr>
            <th scope="col">{t.colTime}</th>
            <th scope="col">{t.colUser}</th>
            <th scope="col">{t.colInput}</th>
            <th scope="col">{t.colSource}</th>
            <th scope="col">{t.colModel}</th>
            <th scope="col" className="num">
              {t.colTokens}
            </th>
            <th scope="col" className="num">
              {t.colCost}
            </th>
            <th scope="col">{t.colStatus}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const selected =
              item.sourceMode === 'auto' ? t.autoDetect : sourceLabel(item.sourceMode, lang);
            const detected = item.detectedSource
              ? sourceLabel(item.detectedSource, lang)
              : t.notAvailable;
            return (
              <tr key={item.id} className="is-clickable" onClick={() => onOpen(item.id)}>
                <td className="nowrap">{formatDateTime(item.createdAt, locale)}</td>
                <td>{item.username}</td>
                <td className="data-table__input">
                  <button
                    type="button"
                    className="row-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(item.id);
                    }}
                    title={t.openDetail}
                  >
                    {item.inputPreview}
                  </button>
                </td>
                <td className="small nowrap">
                  <code title={`${selected} → ${detected}`}>
                    {item.sourceMode} → {item.detectedSource ?? '—'}
                  </code>
                </td>
                <td className="small nowrap">{item.model}</td>
                <td className="num">{formatNumber(item.totalTokens, locale)}</td>
                <td className="num">{formatUsd(item.estimatedTotalCostUsd, locale)}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
