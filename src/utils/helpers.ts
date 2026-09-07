import { CURRENCIES, CurrencyCode } from '@/store/types';

const currencyCache: Record<string, string> = {};

export function getCurrencySymbol(code: CurrencyCode): string {
  if (currencyCache[code]) return currencyCache[code];
  const found = CURRENCIES.find((c) => c.code === code);
  const symbol = found?.symbol || code;
  currencyCache[code] = symbol;
  return symbol;
}

export function formatAmount(amount: number, currencyCode: CurrencyCode = 'INR'): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(timeStr: string): string {
  const d = new Date(timeStr);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(dateStr: string, timeStr: string): string {
  return `${formatDate(dateStr)} at ${formatTime(timeStr)}`;
}

export function getRelativeDay(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return formatDate(dateStr);
}

export function toDateInputValue(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  return dateStr.split('T')[0];
}

export function toTimeInputValue(timeStr: string): string {
  if (!timeStr) {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
  const d = new Date(timeStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function combineDateAndTime(dateStr: string, timeStr: string): { date: string; time: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  const dateObj = new Date(y, m - 1, d, h || 0, min || 0);
  return {
    date: dateObj.toISOString(),
    time: dateObj.toISOString(),
  };
}
