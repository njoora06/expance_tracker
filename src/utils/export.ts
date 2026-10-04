import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { Customer, CurrencyCode, CustomerTransaction } from '@/store/types';
import { getCurrencySymbol } from '@/utils/helpers';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function arrayToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface ExportRow {
  customerName: string;
  txn: CustomerTransaction;
}

// ---------------------------------------------------------------------------
// Transactions sheet
// ---------------------------------------------------------------------------

function buildTransactionsSheet(rows: ExportRow[], includeCustomer: boolean, amountFormat: string): XLSX.WorkSheet {
  const data = rows.map(({ customerName, txn: t }, i) => ({
    '#': i + 1,
    ...(includeCustomer ? { Customer: customerName } : {}),
    Date: new Date(t.date).toLocaleDateString(),
    Time: new Date(t.time).toLocaleTimeString(),
    Type: t.type === 'credit' ? 'Credit (Given)' : 'Debit (Received)',
    Amount: t.amount,
    'Payment Method': t.paymentMethod,
    Notes: t.notes || '',
    'Running Balance': t.runningBalance,
  }));
  const ws = XLSX.utils.json_to_sheet(data);

  const headers = Object.keys(data[0] ?? { '#': 0 });
  const amountCols = ['Amount', 'Running Balance'].map((h) => headers.indexOf(h)).filter((c) => c >= 0);
  for (let r = 1; r <= data.length; r++) {
    for (const c of amountCols) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell) cell.z = amountFormat;
    }
  }
  const widths: Record<string, number> = { '#': 5, Customer: 22, Date: 14, Time: 12, Type: 18, Amount: 14, 'Payment Method': 16, Notes: 30, 'Running Balance': 16 };
  ws['!cols'] = headers.map((h) => ({ wch: widths[h] ?? 14 }));
  return ws;
}

// ---------------------------------------------------------------------------
// Summary sheet (pivot-table layout)
// ---------------------------------------------------------------------------

interface SummaryInput {
  title: string;
  scope: string;
  period: string;
  currency: CurrencyCode;
  rows: ExportRow[];
  openingBalance: number;
  closingBalance: number;
  /** Per-customer closing balances; adds a "By Customer" pivot when there is more than one. */
  customers?: { id: string; name: string; closingBalance: number }[];
}

interface Totals {
  credit: number;
  debit: number;
  count: number;
}

function groupBy(rows: ExportRow[], key: (row: ExportRow) => string): Map<string, Totals> {
  const groups = new Map<string, Totals>();
  for (const row of rows) {
    const k = key(row);
    const g = groups.get(k) ?? { credit: 0, debit: 0, count: 0 };
    if (row.txn.type === 'credit') g.credit += row.txn.amount;
    else g.debit += row.txn.amount;
    g.count += 1;
    groups.set(k, g);
  }
  return groups;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Small cursor-based writer: SheetJS needs cell objects for number formats and formulas. */
class SheetWriter {
  ws: XLSX.WorkSheet = {};
  row = 0;
  private maxCol = 0;
  private merges: XLSX.Range[] = [];

  constructor(private amountFormat: string) {}

  private put(r: number, c: number, cell: XLSX.CellObject) {
    this.ws[XLSX.utils.encode_cell({ r, c })] = cell;
    this.maxCol = Math.max(this.maxCol, c);
  }

  text(c: number, v: string) {
    this.put(this.row, c, { t: 's', v });
  }

  amount(c: number, v: number, f?: string) {
    this.put(this.row, c, { t: 'n', v, z: this.amountFormat, ...(f ? { f } : {}) });
  }

  count(c: number, v: number, f?: string) {
    this.put(this.row, c, { t: 'n', v, z: '0', ...(f ? { f } : {}) });
  }

  /** Full-width heading spanning `span` columns. */
  heading(v: string, span = 6) {
    this.text(0, v);
    this.merges.push({ s: { r: this.row, c: 0 }, e: { r: this.row, c: span - 1 } });
    this.row++;
  }

  next(lines = 1) {
    this.row += lines;
  }

  finish(widths: number[]): XLSX.WorkSheet {
    this.ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(this.row - 1, 0), c: this.maxCol } });
    this.ws['!merges'] = this.merges;
    this.ws['!cols'] = widths.map((wch) => ({ wch }));
    return this.ws;
  }
}

const col = (c: number) => XLSX.utils.encode_col(c);

/**
 * Pivot block: one row per group with Credit / Debit / Net / Count columns and a Grand Total row.
 * Net and the totals are live formulas (with cached values) so edits in Excel recalculate.
 */
function writePivot(
  w: SheetWriter,
  title: string,
  rowLabel: string,
  groups: { label: string; totals: Totals; extra?: number }[],
  extraHeader?: string
) {
  w.heading(title);
  const headers = [rowLabel, 'Credit (Given)', 'Debit (Received)', 'Net (Credit − Debit)', 'Transactions'];
  if (extraHeader) headers.push(extraHeader);
  headers.forEach((h, c) => w.text(c, h));
  w.next();

  const first = w.row + 1; // 1-based Excel row of the first data row
  for (const g of groups) {
    const excelRow = w.row + 1;
    w.text(0, g.label);
    w.amount(1, g.totals.credit);
    w.amount(2, g.totals.debit);
    w.amount(3, g.totals.credit - g.totals.debit, `B${excelRow}-C${excelRow}`);
    w.count(4, g.totals.count);
    if (extraHeader) w.amount(5, g.extra ?? 0);
    w.next();
  }
  const last = w.row; // 1-based Excel row of the last data row

  const sum = (key: keyof Totals) => groups.reduce((s, g) => s + g.totals[key], 0);
  const range = (c: number) => (groups.length ? `SUM(${col(c)}${first}:${col(c)}${last})` : undefined);
  w.text(0, 'Grand Total');
  w.amount(1, sum('credit'), range(1));
  w.amount(2, sum('debit'), range(2));
  w.amount(3, sum('credit') - sum('debit'), range(3));
  w.count(4, sum('count'), range(4));
  if (extraHeader) w.amount(5, groups.reduce((s, g) => s + (g.extra ?? 0), 0), range(5));
  w.next(2);
}

/** Cross-tab: months down, payment methods across, net amount in the cells, totals on both axes. */
function writeCrossTab(w: SheetWriter, rows: ExportRow[], months: string[], methods: string[]) {
  w.heading('Net Amount by Month × Payment Method', methods.length + 2);
  w.text(0, 'Month');
  methods.forEach((m, i) => w.text(i + 1, m));
  w.text(methods.length + 1, 'Grand Total');
  w.next();

  const net = new Map<string, number>();
  for (const { txn } of rows) {
    const k = `${monthKey(txn.date)}|${txn.paymentMethod}`;
    net.set(k, (net.get(k) ?? 0) + (txn.type === 'credit' ? txn.amount : -txn.amount));
  }

  const first = w.row + 1;
  const lastMethodCol = col(methods.length);
  for (const month of months) {
    const excelRow = w.row + 1;
    w.text(0, monthLabel(month));
    let rowTotal = 0;
    methods.forEach((m, i) => {
      const v = net.get(`${month}|${m}`) ?? 0;
      rowTotal += v;
      w.amount(i + 1, v);
    });
    w.amount(methods.length + 1, rowTotal, `SUM(B${excelRow}:${lastMethodCol}${excelRow})`);
    w.next();
  }
  const last = w.row;

  w.text(0, 'Grand Total');
  for (let c = 1; c <= methods.length + 1; c++) {
    const v =
      c <= methods.length
        ? months.reduce((s, m) => s + (net.get(`${m}|${methods[c - 1]}`) ?? 0), 0)
        : rows.reduce((s, { txn }) => s + (txn.type === 'credit' ? txn.amount : -txn.amount), 0);
    w.amount(c, v, months.length ? `SUM(${col(c)}${first}:${col(c)}${last})` : undefined);
  }
  w.next(2);
}

function buildSummarySheet(input: SummaryInput, amountFormat: string): XLSX.WorkSheet {
  const { rows } = input;
  const w = new SheetWriter(amountFormat);

  // Report header
  w.heading(`FinTrack — ${input.title}`);
  for (const [label, value] of [
    ['Customer', input.scope],
    ['Period', input.period],
    ['Currency', input.currency],
    ['Generated', new Date().toLocaleString()],
  ]) {
    w.text(0, label);
    w.text(1, value);
    w.next();
  }
  w.next();

  // Key figures
  const credit = rows.filter((r) => r.txn.type === 'credit').reduce((s, r) => s + r.txn.amount, 0);
  const debit = rows.filter((r) => r.txn.type === 'debit').reduce((s, r) => s + r.txn.amount, 0);
  w.heading('Key Figures', 2);
  w.text(0, 'Measure');
  w.text(1, 'Value');
  w.next();
  const figures: [string, number, 'amount' | 'count'][] = [
    ['Opening Balance', input.openingBalance, 'amount'],
    ['Total Credit (Given)', credit, 'amount'],
    ['Total Debit (Received)', debit, 'amount'],
    ['Net Change', credit - debit, 'amount'],
    ['Closing Balance', input.closingBalance, 'amount'],
    ['Transactions', rows.length, 'count'],
    ['Average Transaction', rows.length ? (credit + debit) / rows.length : 0, 'amount'],
  ];
  for (const [label, value, kind] of figures) {
    w.text(0, label);
    if (kind === 'amount') w.amount(1, value);
    else w.count(1, value);
    w.next();
  }
  w.next();

  if (rows.length === 0) {
    w.text(0, 'No transactions in this period.');
    w.next();
    return w.finish([26, 18, 18, 22, 14, 18]);
  }

  // Pivot: by customer (multi-customer reports only)
  if (input.customers && input.customers.length > 1) {
    const byCustomer = groupBy(rows, (r) => r.txn.customerId);
    const groups = input.customers
      .map((c) => ({ label: c.name, totals: byCustomer.get(c.id) ?? { credit: 0, debit: 0, count: 0 }, extra: c.closingBalance }))
      .sort((a, b) => a.label.localeCompare(b.label));
    writePivot(w, 'Summary by Customer', 'Customer', groups, 'Closing Balance');
  }

  // Pivot: by month (chronological)
  const byMonth = groupBy(rows, (r) => monthKey(r.txn.date));
  const months = [...byMonth.keys()].sort();
  writePivot(w, 'Summary by Month', 'Month', months.map((m) => ({ label: monthLabel(m), totals: byMonth.get(m)! })));

  // Pivot: by payment method (largest volume first)
  const byMethod = groupBy(rows, (r) => r.txn.paymentMethod || 'Unspecified');
  const methods = [...byMethod.entries()]
    .sort((a, b) => b[1].credit + b[1].debit - (a[1].credit + a[1].debit))
    .map(([m]) => m);
  writePivot(w, 'Summary by Payment Method', 'Payment Method', methods.map((m) => ({ label: m, totals: byMethod.get(m)! })));

  // Cross-tab: month × payment method
  writeCrossTab(w, rows, months, methods);

  return w.finish([26, 18, 18, 22, 14, 18, ...methods.map(() => 16)]);
}

// ---------------------------------------------------------------------------
// Workbook writing
// ---------------------------------------------------------------------------

function amountFormatFor(currency: CurrencyCode): string {
  const symbol = getCurrencySymbol(currency).replace(/"/g, '');
  return `"${symbol}"#,##0.00;-"${symbol}"#,##0.00`;
}

async function writeAndShare(wb: XLSX.WorkBook, fileName: string, dialogTitle: string) {
  const wbArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const base64 = arrayToBase64(wbArray);

  const file = new File(Paths.document, fileName);
  file.create({ overwrite: true });
  file.write(base64, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: XLSX_MIME, dialogTitle });
  }
}

function safeSheetName(name: string): string {
  // Excel sheet names: max 31 chars, no []:*?/\
  return name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_');
}

export async function exportCustomerLedger(
  customer: Customer,
  transactions: CustomerTransaction[],
  currency: CurrencyCode = 'INR',
): Promise<boolean> {
  try {
    const fmt = amountFormatFor(currency);
    const rows = transactions.map((txn) => ({ customerName: customer.name, txn }));
    const credit = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const debit = transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    const dates = transactions.map((t) => new Date(t.date).getTime());

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      buildSummarySheet(
        {
          title: 'Customer Ledger',
          scope: customer.name,
          period: dates.length
            ? `${new Date(Math.min(...dates)).toLocaleDateString()} – ${new Date(Math.max(...dates)).toLocaleDateString()}`
            : 'All time',
          currency,
          rows,
          openingBalance: customer.openingBalance,
          closingBalance: customer.openingBalance + credit - debit,
        },
        fmt
      ),
      'Summary'
    );
    XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(rows, false, fmt), safeSheetName(`Ledger - ${customer.name}`));

    await writeAndShare(wb, `ledger_${safeFileName(customer.name)}_${Date.now()}.xlsx`, `Export Ledger - ${customer.name}`);
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
}

export interface ReportExportOptions {
  /** Customer name, or "All customers". */
  scope: string;
  period: string;
  filename: string;
  currency: CurrencyCode;
  rows: ExportRow[];
  openingBalance: number;
  closingBalance: number;
  /** Pass for all-customer reports to add the per-customer pivot and a Customer column. */
  customers?: { id: string; name: string; closingBalance: number }[];
}

export async function exportCustomerReport(options: ReportExportOptions): Promise<boolean> {
  try {
    const fmt = amountFormatFor(options.currency);
    const multi = !!options.customers;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      buildSummarySheet({ ...options, title: multi ? 'All Customers Report' : 'Customer Report' }, fmt),
      'Summary'
    );
    XLSX.utils.book_append_sheet(wb, buildTransactionsSheet(options.rows, multi, fmt), 'Transactions');

    await writeAndShare(wb, `${safeFileName(options.filename)}_${Date.now()}.xlsx`, `Export Report - ${options.scope}`);
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
}
