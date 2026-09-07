import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '@/store/types';
import {
  registerUser,
  loginUser,
  getSession,
  logoutUser,
  getUserProfile,
  updateUserProfile,
} from '@/store/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string, profilePhoto?: string) => Promise<string | null>;
  logout: () => Promise<void>;
  updateProfile: (profilePhoto: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const session = await getSession();
      if (session) {
        const profile = await getUserProfile(session.userId);
        if (profile) {
          setUser(profile);
        }
      }
    } catch (e) {
      console.error('[Auth] Failed to load user:', e);
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const result = await loginUser(email, password);
      setUser(result.user);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    }
  }, []);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    profilePhoto?: string
  ): Promise<string | null> => {
    try {
      const result = await registerUser(name, email, password, profilePhoto);
      setUser(result.user);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (profilePhoto: string) => {
    if (!user) return;
    const updated = await updateUserProfile(user.id, { profilePhoto });
    setUser(updated);
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
  }), [user, loading, login, register, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
