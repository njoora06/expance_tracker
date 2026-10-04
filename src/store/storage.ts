import { getDb, generateId } from './database';
import { triggerDataRefresh } from './dataRefresh';
import { Customer, CustomerTransaction, CustomerFilter, Settings, TransactionType, PaymentMethod } from './types';

let _currentUserId: string | null = null;

export function setStorageUserId(userId: string | null) {
  _currentUserId = userId;
}

export { generateId };

// --- Customers ---

export async function getCustomers(userId: string): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM customers WHERE userId = ? ORDER BY createdAt DESC',
    userId
  );
  return rows.map((r: any) => toCustomer(r));
}

export async function getCustomerById(id: string, _userId: string): Promise<Customer | null> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM customers WHERE _id = ?', id);
  if (rows.length === 0) return null;
  return toCustomer(rows[0] as any);
}

export async function addCustomer(
  customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<Customer> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO customers (_id, userId, name, mobile, email, address, openingBalance, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, customer.name, customer.mobile, customer.email, customer.address,
     customer.openingBalance, customer.notes, now, now]
  );
  triggerDataRefresh();

  return {
    id,
    ...customer,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateCustomer(
  id: string,
  updates: Partial<Omit<Customer, 'id' | 'createdAt'>>,
  _userId: string
): Promise<Customer | null> {
  const db = await getDb();

  const existing = await db.getAllAsync('SELECT * FROM customers WHERE _id = ?', id);
  if (existing.length === 0) return null;

  const sets: string[] = [];
  const params: any[] = [];

  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.mobile !== undefined) { sets.push('mobile = ?'); params.push(updates.mobile); }
  if (updates.email !== undefined) { sets.push('email = ?'); params.push(updates.email); }
  if (updates.address !== undefined) { sets.push('address = ?'); params.push(updates.address); }
  if (updates.openingBalance !== undefined) { sets.push('openingBalance = ?'); params.push(updates.openingBalance); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }

  const now = new Date().toISOString();
  sets.push('updatedAt = ?');
  params.push(now);
  params.push(id);

  await db.runAsync(
    `UPDATE customers SET ${sets.join(', ')} WHERE _id = ?`,
    params
  );
  triggerDataRefresh();

  const rows = await db.getAllAsync('SELECT * FROM customers WHERE _id = ?', id);
  return toCustomer(rows[0] as any);
}

export async function deleteCustomer(id: string, _userId: string): Promise<boolean> {
  const db = await getDb();

  const existing = await db.getAllAsync('SELECT _id FROM customers WHERE _id = ?', id);
  if (existing.length === 0) return false;

  await db.runAsync('DELETE FROM transactions WHERE customerId = ?', id);
  await db.runAsync('DELETE FROM customers WHERE _id = ?', id);
  triggerDataRefresh();

  return true;
}

export async function searchCustomers(
  filter: CustomerFilter,
  userId: string
): Promise<Customer[]> {
  let customers = await getCustomers(userId);

  if (filter.searchQuery) {
    const q = filter.searchQuery.toLowerCase();
    customers = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
    );
  }

  const sortBy = filter.sortBy || 'name';
  const sortOrder = filter.sortOrder || 'asc';

  customers.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'date':
        comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        break;
      case 'balance':
        break;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return customers;
}

export async function getCustomerCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT COUNT(*) as count FROM customers WHERE userId = ?',
    userId
  );
  return (rows[0] as any).count;
}

// --- Customer Balances ---

export async function getCustomerBalance(customerId: string, _userId: string): Promise<number> {
  const customer = await getCustomerById(customerId, _userId);
  if (!customer) return 0;
  const transactions = await getTransactions(customerId, _userId);
  return customer.openingBalance + transactions.reduce((sum, t) => {
    return t.type === 'credit' ? sum + t.amount : sum - t.amount;
  }, 0);
}

export async function getCustomerTotals(
  customerId: string,
  userId: string
): Promise<{ totalCredit: number; totalDebit: number; balance: number }> {
  const customer = await getCustomerById(customerId, userId);
  if (!customer) return { totalCredit: 0, totalDebit: 0, balance: 0 };
  const transactions = await getTransactions(customerId, userId);
  const totalCredit = transactions
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);
  const totalDebit = transactions
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);
  const balance = customer.openingBalance + totalCredit - totalDebit;
  return { totalCredit, totalDebit, balance };
}

export async function getAllCustomersBalance(userId: string): Promise<{
  totalReceivable: number;
  totalPayable: number;
}> {
  const customers = await getCustomers(userId);
  let totalReceivable = 0;
  let totalPayable = 0;
  for (const c of customers) {
    const { balance } = await getCustomerTotals(c.id, userId);
    if (balance > 0) totalReceivable += balance;
    else totalPayable += Math.abs(balance);
  }
  return { totalReceivable, totalPayable };
}

// --- Transactions ---

export async function getTransactions(
  customerId: string,
  _userId: string
): Promise<CustomerTransaction[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM transactions WHERE customerId = ? ORDER BY createdAt DESC',
    customerId
  );
  return rows.map((r: any) => toTransaction(r));
}

export async function addTransaction(
  transaction: Omit<CustomerTransaction, 'id' | 'runningBalance' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<CustomerTransaction> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = generateId();

  const existingTxns = await db.getAllAsync(
    'SELECT * FROM transactions WHERE customerId = ? ORDER BY createdAt ASC',
    transaction.customerId
  );

  const customerRows = await db.getAllAsync(
    'SELECT openingBalance FROM customers WHERE _id = ?',
    transaction.customerId
  );
  const openingBalance = customerRows.length > 0 ? (customerRows[0] as any).openingBalance : 0;

  const previousRunningBalance = existingTxns.length > 0
    ? (existingTxns[existingTxns.length - 1] as any).runningBalance
    : openingBalance;

  const delta = transaction.type === 'credit' ? transaction.amount : -transaction.amount;
  const runningBalance = previousRunningBalance + delta;

  await db.runAsync(
    `INSERT INTO transactions (_id, customerId, userId, amount, type, date, time, paymentMethod, notes, runningBalance, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, transaction.customerId, userId, transaction.amount, transaction.type,
     transaction.date, transaction.time, transaction.paymentMethod, transaction.notes,
     runningBalance, now, now]
  );
  triggerDataRefresh();

  return {
    id,
    customerId: transaction.customerId,
    amount: transaction.amount,
    type: transaction.type,
    date: transaction.date,
    time: transaction.time,
    paymentMethod: transaction.paymentMethod,
    notes: transaction.notes,
    runningBalance,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deleteTransaction(
  transactionId: string,
  customerId: string,
  _userId: string
): Promise<boolean> {
  const db = await getDb();

  const existing = await db.getAllAsync('SELECT _id FROM transactions WHERE _id = ?', transactionId);
  if (existing.length === 0) return false;

  await db.runAsync('DELETE FROM transactions WHERE _id = ?', transactionId);

  // Recalculate running balances for remaining transactions
  const remaining = await db.getAllAsync(
    'SELECT * FROM transactions WHERE customerId = ? ORDER BY createdAt ASC',
    customerId
  );

  const customerRows = await db.getAllAsync(
    'SELECT openingBalance FROM customers WHERE _id = ?',
    customerId
  );
  const openingBalance = customerRows.length > 0 ? (customerRows[0] as any).openingBalance : 0;

  let runningBalance = openingBalance;
  for (const t of remaining as any[]) {
    const delta = t.type === 'credit' ? t.amount : -t.amount;
    runningBalance += delta;
    await db.runAsync('UPDATE transactions SET runningBalance = ? WHERE _id = ?', [runningBalance, t._id]);
  }
  triggerDataRefresh();

  return true;
}

export async function updateTransaction(
  transactionId: string,
  customerId: string,
  updates: {
    amount?: number;
    type?: TransactionType;
    date?: string;
    time?: string;
    paymentMethod?: PaymentMethod;
    notes?: string;
  },
  _userId: string
): Promise<CustomerTransaction | null> {
  const db = await getDb();

  const existing = await db.getAllAsync('SELECT * FROM transactions WHERE _id = ?', transactionId);
  if (existing.length === 0) return null;

  const now = new Date().toISOString();
  const sets: string[] = [];
  const params: any[] = [];

  if (updates.amount !== undefined) { sets.push('amount = ?'); params.push(updates.amount); }
  if (updates.type !== undefined) { sets.push('type = ?'); params.push(updates.type); }
  if (updates.date !== undefined) { sets.push('date = ?'); params.push(updates.date); }
  if (updates.time !== undefined) { sets.push('time = ?'); params.push(updates.time); }
  if (updates.paymentMethod !== undefined) { sets.push('paymentMethod = ?'); params.push(updates.paymentMethod); }
  if (updates.notes !== undefined) { sets.push('notes = ?'); params.push(updates.notes); }

  if (sets.length === 0) return toTransaction(existing[0] as any);

  sets.push('updatedAt = ?');
  params.push(now);
  params.push(transactionId);

  await db.runAsync(
    `UPDATE transactions SET ${sets.join(', ')} WHERE _id = ?`,
    params
  );

  // Recalculate running balances for all transactions of this customer
  const customerRows = await db.getAllAsync(
    'SELECT openingBalance FROM customers WHERE _id = ?',
    customerId
  );
  const openingBalance = customerRows.length > 0 ? (customerRows[0] as any).openingBalance : 0;

  const allTxns = await db.getAllAsync(
    'SELECT * FROM transactions WHERE customerId = ? ORDER BY createdAt ASC',
    customerId
  );

  let runningBalance = openingBalance;
  for (const t of allTxns as any[]) {
    const delta = t.type === 'credit' ? t.amount : -t.amount;
    runningBalance += delta;
    await db.runAsync('UPDATE transactions SET runningBalance = ? WHERE _id = ?', [runningBalance, t._id]);
  }

  triggerDataRefresh();

  const updated = await db.getAllAsync('SELECT * FROM transactions WHERE _id = ?', transactionId);
  return updated.length > 0 ? toTransaction(updated[0] as any) : null;
}

export async function getTransactionsByDateRange(
  customerId: string,
  start: Date,
  end: Date,
  _userId: string
): Promise<CustomerTransaction[]> {
  const db = await getDb();
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  const rows = await db.getAllAsync(
    'SELECT * FROM transactions WHERE customerId = ? AND date >= ? AND date <= ? ORDER BY date DESC',
    [customerId, startStr, endStr]
  );
  return rows.map((r: any) => toTransaction(r));
}

// --- Reports ---

export async function getCustomerReport(
  customerId: string,
  start: Date,
  end: Date,
  userId: string
): Promise<{
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  transactions: CustomerTransaction[];
}> {
  const transactions = await getTransactionsByDateRange(customerId, start, end, userId);
  const customer = await getCustomerById(customerId, userId);
  const openingBalance = customer?.openingBalance || 0;

  const totalCredit = transactions
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);
  const totalDebit = transactions
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0);

  const earliestTxn = transactions.length > 0
    ? transactions[transactions.length - 1]
    : null;
  const prePeriodBalance = earliestTxn
    ? earliestTxn.runningBalance - (earliestTxn.type === 'credit' ? earliestTxn.amount : -earliestTxn.amount)
    : openingBalance;

  const closingBalance = prePeriodBalance + totalCredit - totalDebit;

  return {
    totalCredit,
    totalDebit,
    closingBalance,
    transactions: transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  };
}

export async function getAllCustomersReport(
  start: Date,
  end: Date,
  userId: string
): Promise<{
  customerId: string;
  customerName: string;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  transactions: CustomerTransaction[];
}[]> {
  const customers = await getCustomers(userId);
  const reports = [];
  for (const c of customers) {
    const { totalCredit, totalDebit, closingBalance, transactions } = await getCustomerReport(c.id, start, end, userId);
    reports.push({
      customerId: c.id,
      customerName: c.name,
      totalCredit,
      totalDebit,
      closingBalance,
      transactions,
    });
  }
  return reports;
}

// --- Today / Month transactions ---

async function getAllTransactions(userId: string): Promise<{ customerId: string; customerName: string; transaction: CustomerTransaction }[]> {
  const customers = await getCustomers(userId);
  const all: { customerId: string; customerName: string; transaction: CustomerTransaction }[] = [];
  for (const c of customers) {
    const txns = await getTransactions(c.id, userId);
    txns.forEach((t) => all.push({ customerId: c.id, customerName: c.name, transaction: t }));
  }
  return all.sort((a, b) => new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime());
}

export async function getTodayTransactions(userId: string) {
  const all = await getAllTransactions(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return all.filter((t) => {
    const d = new Date(t.transaction.date);
    return d >= today && d < tomorrow;
  });
}

export async function getMonthTransactions(userId: string) {
  const all = await getAllTransactions(userId);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return all.filter((t) => {
    const d = new Date(t.transaction.date);
    return d >= start && d <= end;
  });
}

// --- Settings ---

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  currency: 'INR',
};

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  if (!_currentUserId) return DEFAULT_SETTINGS;
  const rows = await db.getAllAsync(
    'SELECT * FROM settings WHERE _id = ?',
    _currentUserId
  );
  if (rows.length === 0) return DEFAULT_SETTINGS;
  const s = rows[0] as any;
  return { theme: s.theme, currency: s.currency };
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  const db = await getDb();
  const id = _currentUserId || 'default';
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (_id, userId, theme, currency) VALUES (?, ?, ?, ?)',
    [id, _currentUserId || 'default', updated.theme, updated.currency]
  );
  return updated;
}

// --- Backup & Restore ---

export async function backupData(userId: string): Promise<string> {
  const customers = await getCustomers(userId);
  const allTxns: Record<string, CustomerTransaction[]> = {};
  for (const c of customers) {
    allTxns[c.id] = await getTransactions(c.id, userId);
  }
  const transactionCount = Object.values(allTxns).reduce((n, list) => n + list.length, 0);
  // `customers` and `transactions` are what restoreData() reads; the rest is descriptive metadata.
  return JSON.stringify({
    app: 'FinTrack',
    version: 1,
    createdAt: new Date().toISOString(),
    counts: { customers: customers.length, transactions: transactionCount },
    customers,
    transactions: allTxns,
  });
}

export async function restoreData(data: string, userId: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(data);
    if (!parsed.customers || !parsed.transactions) return 'Invalid backup format';
    if (!Array.isArray(parsed.customers)) return 'Invalid customers data';

    const db = await getDb();
    const customers: Customer[] = parsed.customers;
    const allTxns: Record<string, CustomerTransaction[]> = parsed.transactions;

    for (const c of customers) {
      await db.runAsync(
        `INSERT OR REPLACE INTO customers (_id, userId, name, mobile, email, address, openingBalance, notes, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, userId, c.name, c.mobile, c.email, c.address, c.openingBalance, c.notes, c.createdAt, c.updatedAt]
      );
    }

    for (const customerId of Object.keys(allTxns)) {
      const txns = allTxns[customerId];
      if (!Array.isArray(txns)) continue;
      for (const t of txns) {
        await db.runAsync(
          `INSERT OR REPLACE INTO transactions (_id, customerId, userId, amount, type, date, time, paymentMethod, notes, runningBalance, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.customerId, userId, t.amount, t.type, t.date, t.time, t.paymentMethod, t.notes, t.runningBalance, t.createdAt, t.updatedAt]
        );
      }
    }

    triggerDataRefresh();
    return null;
  } catch (e) {
    return 'Failed to parse backup data';
  }
}

export async function clearAllData(userId: string): Promise<void> {
  const db = await getDb();
  const customers = await db.getAllAsync(
    'SELECT _id FROM customers WHERE userId = ?',
    userId
  );
  for (const c of customers as any[]) {
    await db.runAsync('DELETE FROM transactions WHERE customerId = ?', c._id);
  }
  await db.runAsync('DELETE FROM customers WHERE userId = ?', userId);
  triggerDataRefresh();
}

// --- Helpers ---

function toCustomer(c: any): Customer {
  return {
    id: c._id,
    name: c.name,
    mobile: c.mobile,
    email: c.email,
    address: c.address,
    openingBalance: c.openingBalance,
    notes: c.notes,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function toTransaction(t: any): CustomerTransaction {
  return {
    id: t._id,
    customerId: t.customerId,
    amount: t.amount,
    type: t.type,
    date: t.date,
    time: t.time,
    paymentMethod: t.paymentMethod,
    notes: t.notes,
    runningBalance: t.runningBalance,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
