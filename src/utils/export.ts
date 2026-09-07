import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { Customer, CustomerTransaction } from '@/store/types';

function arrayToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function exportCustomerLedger(
  customer: Customer,
  transactions: CustomerTransaction[],
  currency: string = 'INR',
): Promise<boolean> {
  try {
    const data = transactions.map((t, i) => ({
      '#': i + 1,
      Date: new Date(t.date).toLocaleDateString(),
      Time: new Date(t.time).toLocaleTimeString(),
      Type: t.type === 'credit' ? 'Credit (Given)' : 'Debit (Received)',
      Amount: t.amount,
      'Payment Method': t.paymentMethod,
      Notes: t.notes || '',
      'Running Balance': t.runningBalance,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    const colWidths = [
      { wch: 5 }, { wch: 15 }, { wch: 10 }, { wch: 18 },
      { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 16 },
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, `Ledger - ${customer.name}`);

    // Add summary sheet
    const summaryData = [
      { Field: 'Customer Name', Value: customer.name },
      { Field: 'Mobile', Value: customer.mobile || '-' },
      { Field: 'Email', Value: customer.email || '-' },
      { Field: 'Opening Balance', Value: customer.openingBalance },
      { Field: 'Total Credit', Value: transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0) },
      { Field: 'Total Debit', Value: transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0) },
      { Field: 'Closing Balance', Value: transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : customer.openingBalance },
      { Field: 'Currency', Value: currency },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const wbArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const base64 = arrayToBase64(wbArray);

    const file = new File(Paths.document, `ledger_${customer.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
    file.create({ overwrite: true });
    file.write(base64, { encoding: 'base64' });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Export Ledger - ${customer.name}`,
      });
    }
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
}

export async function exportCustomerReport(
  report: { totalCredit: number; totalDebit: number; closingBalance: number; transactions: CustomerTransaction[] },
  customerName: string,
  filename: string = 'report',
  currency: string = 'INR',
): Promise<boolean> {
  try {
    const data = report.transactions.map((t, i) => ({
      '#': i + 1,
      Date: new Date(t.date).toLocaleDateString(),
      Time: new Date(t.time).toLocaleTimeString(),
      Type: t.type === 'credit' ? 'Credit (Given)' : 'Debit (Received)',
      Amount: t.amount,
      'Payment Method': t.paymentMethod,
      Notes: t.notes || '',
      'Running Balance': t.runningBalance,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    const colWidths = [
      { wch: 5 }, { wch: 15 }, { wch: 10 }, { wch: 18 },
      { wch: 12 }, { wch: 18 }, { wch: 30 }, { wch: 16 },
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const summaryData = [
      { Field: 'Customer', Value: customerName },
      { Field: 'Total Credit', Value: report.totalCredit },
      { Field: 'Total Debit', Value: report.totalDebit },
      { Field: 'Closing Balance', Value: report.closingBalance },
      { Field: 'Currency', Value: currency },
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    const wbArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const base64 = arrayToBase64(wbArray);

    const file = new File(Paths.document, `${filename}_${Date.now()}.xlsx`);
    file.create({ overwrite: true });
    file.write(base64, { encoding: 'base64' });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: `Export Report - ${customerName}`,
      });
    }
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    return false;
  }
}
