import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { getDb, generateId } from './database';

function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    password
  );
}

function generateToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

export async function registerUser(
  fullName: string,
  email: string,
  password: string,
  profilePhoto?: string
): Promise<{ user: { id: string; fullName: string; email: string; passwordHash: string; profilePhoto?: string; createdAt: string }; session: { userId: string; email: string; fullName: string; token: string; createdAt: string } }> {
  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db.getAllAsync(
    'SELECT _id FROM users WHERE email = ?',
    normalizedEmail
  );
  if (existing.length > 0) {
    throw new Error('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const userId = generateId();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT INTO users (_id, fullName, email, passwordHash, profilePhoto, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, fullName.trim(), normalizedEmail, passwordHash, profilePhoto || null, now]
  );

  const token = generateToken();

  await db.runAsync(
    'INSERT OR REPLACE INTO sessions (_id, userId, email, fullName, token, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    ['current', userId, normalizedEmail, fullName.trim(), token, now]
  );

  return {
    user: {
      id: userId,
      fullName: fullName.trim(),
      email: normalizedEmail,
      passwordHash,
      profilePhoto,
      createdAt: now,
    },
    session: {
      userId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      token,
      createdAt: now,
    },
  };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ user: { id: string; fullName: string; email: string; passwordHash: string; profilePhoto?: string; createdAt: string }; session: { userId: string; email: string; fullName: string; token: string; createdAt: string } }> {
  const db = await getDb();
  const normalizedEmail = email.toLowerCase().trim();

  const users = await db.getAllAsync(
    'SELECT * FROM users WHERE email = ?',
    normalizedEmail
  );
  if (users.length === 0) {
    throw new Error('Invalid email or password');
  }

  const userObj = users[0] as any;

  const passwordHash = await hashPassword(password);
  if (passwordHash !== userObj.passwordHash) {
    throw new Error('Invalid email or password');
  }

  const token = generateToken();
  const now = new Date().toISOString();

  await db.runAsync(
    'INSERT OR REPLACE INTO sessions (_id, userId, email, fullName, token, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    ['current', userObj._id, userObj.email, userObj.fullName, token, now]
  );

  return {
    user: {
      id: userObj._id,
      fullName: userObj.fullName,
      email: userObj.email,
      passwordHash: userObj.passwordHash,
      profilePhoto: userObj.profilePhoto,
      createdAt: userObj.createdAt,
    },
    session: {
      userId: userObj._id,
      email: userObj.email,
      fullName: userObj.fullName,
      token,
      createdAt: now,
    },
  };
}

export async function getSession(): Promise<{ userId: string; email: string; fullName: string; token: string; createdAt: string } | null> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM sessions WHERE _id = ?',
    'current'
  );
  if (rows.length === 0) return null;
  const s = rows[0] as any;
  return {
    userId: s.userId,
    email: s.email,
    fullName: s.fullName,
    token: s.token,
    createdAt: s.createdAt,
  };
}

export async function logoutUser(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sessions WHERE _id = ?', 'current');
}

export async function getUserProfile(userId: string): Promise<{
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  profilePhoto?: string;
  createdAt: string;
} | null> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT * FROM users WHERE _id = ?',
    userId
  );
  if (rows.length === 0) return null;
  const u = rows[0] as any;
  return {
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    passwordHash: u.passwordHash,
    profilePhoto: u.profilePhoto,
    createdAt: u.createdAt,
  };
}

export async function updateUserProfile(
  userId: string,
  updates: { name?: string; profilePhoto?: string }
): Promise<{
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  profilePhoto?: string;
  createdAt: string;
}> {
  const db = await getDb();

  if (updates.name) {
    await db.runAsync(
      'UPDATE users SET fullName = ? WHERE _id = ?',
      [updates.name, userId]
    );
    await db.runAsync(
      'UPDATE sessions SET fullName = ? WHERE _id = ?',
      [updates.name, 'current']
    );
  }

  if (updates.profilePhoto !== undefined) {
    await db.runAsync(
      'UPDATE users SET profilePhoto = ? WHERE _id = ?',
      [updates.profilePhoto, userId]
    );
  }

  const rows = await db.getAllAsync(
    'SELECT * FROM users WHERE _id = ?',
    userId
  );
  const u = rows[0] as any;
  return {
    id: u._id,
    fullName: u.fullName,
    email: u.email,
    passwordHash: u.passwordHash,
    profilePhoto: u.profilePhoto,
    createdAt: u.createdAt,
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const db = await getDb();

  const rows = await db.getAllAsync(
    'SELECT * FROM users WHERE _id = ?',
    userId
  );
  if (rows.length === 0) throw new Error('User not found');
  const u = rows[0] as any;

  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== u.passwordHash) {
    throw new Error('Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);
  await db.runAsync(
    'UPDATE users SET passwordHash = ? WHERE _id = ?',
    [newHash, userId]
  );
}

// --- Forgot password (offline, verified with the phone's own screen lock) ---

const RESET_GRANT_TTL_MS = 10 * 60 * 1000;

// Issued only by verifyWithDeviceLock(); resetPassword() refuses to run without it.
// Kept in memory on purpose: it never survives an app restart.
let resetGrant: { token: string; userId: string; expiresAt: number } | null = null;

export async function findUserForReset(email: string): Promise<{ userId: string; fullName: string }> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    'SELECT _id, fullName FROM users WHERE email = ?',
    email.toLowerCase().trim()
  );
  if (rows.length === 0) {
    throw new Error('No account with this email on this device');
  }
  const u = rows[0] as any;
  return { userId: u._id, fullName: u.fullName };
}

export type DeviceLockStatus = 'available' | 'no_lock' | 'unsupported';

export async function getDeviceLockStatus(): Promise<DeviceLockStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  const level = await LocalAuthentication.getEnrolledLevelAsync();
  return level === LocalAuthentication.SecurityLevel.NONE ? 'no_lock' : 'available';
}

export type DeviceLockResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'cancelled' | 'no_lock' | 'failed'; message?: string };

export async function verifyWithDeviceLock(userId: string): Promise<DeviceLockResult> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Verify it's you to reset your password",
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });

  if (result.success) {
    const token = Crypto.randomUUID();
    resetGrant = { token, userId, expiresAt: Date.now() + RESET_GRANT_TTL_MS };
    return { ok: true, token };
  }

  switch (result.error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return { ok: false, reason: 'cancelled' };
    case 'not_enrolled':
    case 'passcode_not_set':
      return { ok: false, reason: 'no_lock' };
    case 'lockout':
      return { ok: false, reason: 'failed', message: 'Too many attempts. Unlock your phone, then try again.' };
    default:
      return { ok: false, reason: 'failed', message: 'Verification failed. Try again.' };
  }
}

export function cancelPasswordReset(): void {
  resetGrant = null;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const grant = resetGrant;
  if (!grant || grant.token !== token || Date.now() > grant.expiresAt) {
    resetGrant = null;
    throw new Error('Verification expired, please verify again');
  }

  const db = await getDb();
  const passwordHash = await hashPassword(newPassword);
  await db.runAsync('UPDATE users SET passwordHash = ? WHERE _id = ?', [passwordHash, grant.userId]);
  // Sign out any saved session for this user so the new password is required.
  await db.runAsync('DELETE FROM sessions WHERE userId = ?', grant.userId);
  resetGrant = null;
}
