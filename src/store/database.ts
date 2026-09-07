import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    try {
      db = await SQLite.openDatabaseAsync('fintrack.db');
      await initDatabase(db);
    } catch (e) {
      db = null;
      throw e;
    }
  }
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL');
  await database.execAsync('PRAGMA foreign_keys = ON');

  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS users (_id TEXT PRIMARY KEY, fullName TEXT NOT NULL, email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, profilePhoto TEXT, createdAt TEXT NOT NULL)'
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS sessions (_id TEXT PRIMARY KEY, userId TEXT NOT NULL, email TEXT NOT NULL, fullName TEXT NOT NULL, token TEXT NOT NULL, createdAt TEXT NOT NULL)'
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS customers (_id TEXT PRIMARY KEY, userId TEXT NOT NULL, name TEXT NOT NULL, mobile TEXT NOT NULL DEFAULT \'\', email TEXT NOT NULL DEFAULT \'\', address TEXT NOT NULL DEFAULT \'\', openingBalance REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT \'\', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'
  );
  await database.execAsync('CREATE INDEX IF NOT EXISTS idx_customers_userId ON customers(userId)');
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS transactions (_id TEXT PRIMARY KEY, customerId TEXT NOT NULL, userId TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL DEFAULT \'\', paymentMethod TEXT NOT NULL DEFAULT \'\', notes TEXT NOT NULL DEFAULT \'\', runningBalance REAL NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'
  );
  await database.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_customerId ON transactions(customerId)');
  await database.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId)');
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS settings (_id TEXT PRIMARY KEY, userId TEXT NOT NULL, theme TEXT NOT NULL DEFAULT \'system\', currency TEXT NOT NULL DEFAULT \'INR\')'
  );
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}-${randomPart2}`;
}
