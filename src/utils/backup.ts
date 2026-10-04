import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { backupData } from '@/store/storage';

const BACKUP_DIR_NAME = 'backups';
const MAX_LOCAL_BACKUPS = 5;
const MIME_TYPE = 'application/json';

export interface BackupInfo {
  name: string;
  /** file:// URI inside app storage; empty on web, where the file is downloaded instead. */
  uri: string;
  size: number;
  createdAt: string;
  counts: { customers: number; transactions: number };
}

export interface BackupPreview {
  text: string;
  createdAt: string | null;
  counts: { customers: number; transactions: number };
}

function backupDir(): Directory {
  return new Directory(Paths.document, BACKUP_DIR_NAME);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function backupFileName(date: Date): string {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `fintrack_backup_${d}_${t}.json`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human-readable label for where app-storage backups live. */
export const APP_BACKUP_LOCATION = `App storage › FinTrack › ${BACKUP_DIR_NAME}`;

/** Writes a JSON backup of the user's customers and transactions to app storage (or downloads it on web). */
export async function createBackupFile(userId: string): Promise<BackupInfo> {
  const json = await backupData(userId);
  const parsed = JSON.parse(json);
  const name = backupFileName(new Date(parsed.createdAt));

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return { name, uri: '', size: blob.size, createdAt: parsed.createdAt, counts: parsed.counts };
  }

  const dir = backupDir();
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, name);
  file.create({ overwrite: true });
  file.write(json);

  pruneOldBackups();

  return {
    name,
    uri: file.uri,
    size: file.size ?? json.length,
    createdAt: parsed.createdAt,
    counts: parsed.counts,
  };
}

function listBackupFiles(): File[] {
  const dir = backupDir();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((f): f is File => f instanceof File && f.name.startsWith('fintrack_backup_'))
    // Names embed a sortable timestamp; sort newest first.
    .sort((a, b) => b.name.localeCompare(a.name));
}

function pruneOldBackups() {
  for (const old of listBackupFiles().slice(MAX_LOCAL_BACKUPS)) {
    try {
      old.delete();
    } catch (e) {
      console.warn('[Backup] Failed to delete old backup', old.name, e);
    }
  }
}

/** Date of the newest backup kept in app storage, or null if there is none. */
export function getLastBackupDate(): Date | null {
  if (Platform.OS === 'web') return null;
  const newest = listBackupFiles()[0];
  if (!newest) return null;
  const time = newest.info().modificationTime;
  return time ? new Date(time) : null;
}

/** Turns an Android SAF tree URI into something like "Internal storage › Download". */
function describeLocation(uri: string): string {
  // Match before decoding: the tree id itself encodes "/" as %2F.
  const match = uri.match(/\/tree\/([^/]+)/);
  if (!match) return 'the selected folder';
  const [volume, ...path] = decodeURIComponent(match[1]).split(':');
  const root = volume === 'primary' ? 'Internal storage' : volume === 'downloads' ? 'Downloads' : 'SD card';
  const folders = path.join(':').split('/').filter(Boolean);
  return [root, ...folders].join(' › ');
}

function isCancel(e: unknown): boolean {
  return e instanceof Error && /cancel/i.test(e.message);
}

/**
 * Lets the user keep a copy outside app storage.
 * Android: system folder picker, then the file is written there. Returns the readable location.
 * iOS: share sheet ("Save to Files"). Returns null because the destination isn't reported back.
 * Returns null if the user cancels.
 */
export async function saveBackupToDevice(info: BackupInfo): Promise<string | null> {
  if (Platform.OS === 'android') {
    let target: Directory;
    try {
      target = await Directory.pickDirectoryAsync();
    } catch (e) {
      if (isCancel(e)) return null;
      throw e;
    }
    const text = await new File(info.uri).text();
    const copy = target.createFile(info.name, MIME_TYPE);
    copy.write(text);
    return describeLocation(target.uri);
  }
  await shareBackup(info);
  return null;
}

/** Opens the system share sheet so the backup can be opened in another app or sent elsewhere. */
export async function shareBackup(info: BackupInfo): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(info.uri, {
    mimeType: MIME_TYPE,
    UTI: 'public.json',
    dialogTitle: 'FinTrack backup',
  });
}

/** Lets the user pick a backup file and validates it. Returns null if the picker was cancelled. */
export async function pickBackupFile(): Promise<BackupPreview | null> {
  const picked = await File.pickFileAsync({ mimeTypes: [MIME_TYPE, 'text/plain', '*/*'] });
  if (picked.canceled) return null;

  const text = await picked.result.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a FinTrack backup file');
  }
  if (!parsed || !Array.isArray(parsed.customers) || typeof parsed.transactions !== 'object') {
    throw new Error('Not a FinTrack backup file');
  }

  const transactionCount = Object.values(parsed.transactions as Record<string, unknown[]>).reduce(
    (n, list) => n + (Array.isArray(list) ? list.length : 0),
    0
  );
  return {
    text,
    createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : null,
    counts: { customers: parsed.customers.length, transactions: transactionCount },
  };
}
