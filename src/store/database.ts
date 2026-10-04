import * as SQLite from 'expo-sqlite';

// Never rename: the file lives in the app's private storage, which survives in-place updates.
// A new name would open an empty database and orphan all existing user data.
const DB_NAME = 'fintrack.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Cache the open+init promise so concurrent callers all wait for the tables to exist.
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DB_NAME);
      await initDatabase(database);
      return database;
    })().catch((e) => {
      console.error('[DB] Failed to open/init database:', e);
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

// Schema changes MUST be added as new entries in MIGRATIONS (never edit a shipped one).
// Only additive changes are allowed (new tables, ALTER TABLE ... ADD COLUMN, new indexes).
// Never DROP/rename user tables or delete the database file: app updates must keep user data.
const SCHEMA_VERSION = 1;

const MIGRATIONS: { version: number; up: (db: SQLite.SQLiteDatabase) => Promise<void> }[] = [
  {
    // Initial schema. Uses IF NOT EXISTS so databases created before versioning adopt it untouched.
    version: 1,
    up: async (db) => {
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS users (_id TEXT PRIMARY KEY, fullName TEXT NOT NULL, email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, profilePhoto TEXT, createdAt TEXT NOT NULL)'
      );
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS sessions (_id TEXT PRIMARY KEY, userId TEXT NOT NULL, email TEXT NOT NULL, fullName TEXT NOT NULL, token TEXT NOT NULL, createdAt TEXT NOT NULL)'
      );
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS customers (_id TEXT PRIMARY KEY, userId TEXT NOT NULL, name TEXT NOT NULL, mobile TEXT NOT NULL DEFAULT \'\', email TEXT NOT NULL DEFAULT \'\', address TEXT NOT NULL DEFAULT \'\', openingBalance REAL NOT NULL DEFAULT 0, notes TEXT NOT NULL DEFAULT \'\', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'
      );
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_customers_userId ON customers(userId)');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS transactions (_id TEXT PRIMARY KEY, customerId TEXT NOT NULL, userId TEXT NOT NULL, amount REAL NOT NULL, type TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL DEFAULT \'\', paymentMethod TEXT NOT NULL DEFAULT \'\', notes TEXT NOT NULL DEFAULT \'\', runningBalance REAL NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL)'
      );
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_customerId ON transactions(customerId)');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_userId ON transactions(userId)');
      await db.execAsync(
        'CREATE TABLE IF NOT EXISTS settings (_id TEXT PRIMARY KEY, userId TEXT NOT NULL, theme TEXT NOT NULL DEFAULT \'system\', currency TEXT NOT NULL DEFAULT \'INR\')'
      );
    },
  },
];

async function initDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  // PRAGMAs that change journaling can't run inside a transaction.
  await database.execAsync('PRAGMA journal_mode = WAL');
  await database.execAsync('PRAGMA foreign_keys = ON');

  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  const existingTable = await database.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
  );

  if (existingTable) {
    console.log(`[DB] Existing database found (schema v${currentVersion}), reusing data`);
  } else {
    console.log('[DB] No existing database, creating new schema');
  }

  if (currentVersion > SCHEMA_VERSION) {
    // An older build was installed over a newer database; leave the data exactly as it is.
    console.warn(`[DB] Database schema v${currentVersion} is newer than app schema v${SCHEMA_VERSION}; skipping migrations`);
    return;
  }

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;
    // Each migration is atomic: on failure it rolls back and existing data stays intact.
    await database.withTransactionAsync(async () => {
      await migration.up(database);
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    console.log(`[DB] Migrated schema to v${migration.version}`);
  }
}

export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const randomPart2 = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}-${randomPart2}`;
}
