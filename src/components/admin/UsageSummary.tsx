import type { UsageSummaryResponse } from '../../../shared/api';
import { useI18n } from '../../i18n/I18nContext';
import { formatDateTime, formatNumber, formatUsd } from '../../lib/format';

export function UsageSummary({ summary }: { summary: UsageSummaryResponse }) {
  const { locale, t } = useI18n();
  const { totals } = summary;
  const cost = (value: number) =>
    summary.pricingConfigured ? formatUsd(value, locale) : t.notAvailable;

  return (
    <>
      {!summary.pricingConfigured && <p className="muted">{t.pricingNotConfigured}</p>}
      <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="usage-heading">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t.colUser}</th>
              <th scope="col" className="num">
                {t.colQueries}
              </th>
              <th scope="col" className="num">
                {t.colSucceeded}
              </th>
              <th scope="col" className="num">
                {t.colFailed}
              </th>
              <th scope="col" className="num">
                {t.colInputTokens}
              </th>
              <th scope="col" className="num">
                {t.colOutputTokens}
              </th>
              <th scope="col" className="num">
                {t.colTotalTokens}
              </th>
              <th scope="col" className="num">
                {t.colCost}
              </th>
              <th scope="col">{t.colLastQuery}</th>
            </tr>
          </thead>
          <tbody>
            {summary.users.map((row) => (
              <tr key={row.userId}>
                <th scope="row">
                  {row.username}{' '}
                  <span className="muted small">
                    ({row.role === 'admin' ? t.roleAdmin : t.roleUser}
                    {!row.isActive && `, ${t.inactive}`})
                  </span>
                </th>
                <td className="num">{formatNumber(row.queryCount, locale)}</td>
                <td className="num">{formatNumber(row.successCount, locale)}</td>
                <td className="num">{formatNumber(row.failureCount, locale)}</td>
                <td className="num">{formatNumber(row.inputTokens, locale)}</td>
                <td className="num">{formatNumber(row.outputTokens, locale)}</td>
                <td className="num">{formatNumber(row.totalTokens, locale)}</td>
                <td className="num">{cost(row.estimatedCostUsd)}</td>
                <td>{formatDateTime(row.lastQueryAt, locale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{t.total}</th>
              <td className="num">{formatNumber(totals.queryCount, locale)}</td>
              <td className="num">{formatNumber(totals.successCount, locale)}</td>
              <td className="num">{formatNumber(totals.failureCount, locale)}</td>
              <td className="num">{formatNumber(totals.inputTokens, locale)}</td>
              <td className="num">{formatNumber(totals.outputTokens, locale)}</td>
              <td className="num">{formatNumber(totals.totalTokens, locale)}</td>
              <td className="num">{cost(totals.estimatedCostUsd)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
