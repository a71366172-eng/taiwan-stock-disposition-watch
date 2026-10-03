import type {Disposition, Stock} from './market-types';

export type DispositionMetrics = {
  calendarDaysUntilEnd: number;
  startClose: number | null;
  latestClose: number | null;
  periodChangePercent: number | null;
  fiveDayChangePercent: number | null;
  tenDayChangePercent: number | null;
  ma20: number | null;
  ma20DeviationPercent: number | null;
};

export function dispositionMetrics(disposition: Disposition, stock: Stock | undefined, asOf: string): DispositionMetrics {
  const end = disposition.end;
  const calendarDaysUntilEnd = end ? Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86400000)) : 0;
  const bars = stock?.bars.filter(bar => bar.date <= asOf && bar.close !== null).sort((a, b) => a.date.localeCompare(b.date)) ?? [];
  const startClose = bars.find(bar => bar.date === disposition.start)?.close ?? null;
  const latestClose = bars.at(-1)?.close ?? (stock?.close ?? null);
  const periodChangePercent = startClose !== null && startClose > 0 && latestClose !== null
    ? (latestClose / startClose - 1) * 100
    : null;
  const changeOverSessions = (sessions: number): number | null => {
    const previousClose = bars.at(-sessions - 1)?.close;
    return previousClose != null && previousClose > 0 && latestClose != null
      ? (latestClose / previousClose - 1) * 100
      : null;
  };
  const fiveDayChangePercent = changeOverSessions(5);
  const tenDayChangePercent = changeOverSessions(10);
  const last20 = bars.slice(-20);
  const ma20 = last20.length === 20 ? last20.reduce((sum, bar) => sum + bar.close!, 0) / 20 : null;
  const ma20DeviationPercent = ma20 !== null && ma20 > 0 && latestClose !== null
    ? (latestClose / ma20 - 1) * 100
    : null;
  return {calendarDaysUntilEnd, startClose, latestClose, periodChangePercent, fiveDayChangePercent, tenDayChangePercent, ma20, ma20DeviationPercent};
}
