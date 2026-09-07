export type TransactionType = 'credit' | 'debit';
export type PaymentMethod = 'Cash' | 'UPI' | 'Bank Transfer' | 'Credit Card' | 'Debit Card';
export type ThemeMode = 'light' | 'dark' | 'system';
export type CurrencyCode = string;

export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  profilePhoto?: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  fullName: string;
  token: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  email: string;
  address: string;
  openingBalance: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTransaction {
  id: string;
  customerId: string;
  amount: number;
  type: TransactionType;
  date: string;
  time: string;
  paymentMethod: PaymentMethod;
  notes: string;
  runningBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  theme: ThemeMode;
  currency: CurrencyCode;
}

export interface CustomerFilter {
  searchQuery?: string;
  sortBy?: 'name' | 'balance' | 'date';
  sortOrder?: 'asc' | 'desc';
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CustomerReport {
  customerId: string;
  customerName: string;
  totalCredit: number;
  totalDebit: number;
  closingBalance: number;
  transactions: CustomerTransaction[];
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'UPI',
  'Bank Transfer',
  'Credit Card',
  'Debit Card',
];

export const CURRENCIES: { code: string; symbol: string; name: string }[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
];
