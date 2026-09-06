import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { api } from '../services/api';

// ─── User type ────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: 'TEACHER' | 'STUDENT';
}

// ─── Auth context ─────────────────────────────────────────────────────────────
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  refetch: async () => {},
  logout: async () => {},
});

// ─── AuthProvider ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {}
    setUser(null);
    window.location.href = '/';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        refetch: fetchMe,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── useAuth ──────────────────────────────────────────────────────────────────
export function useAuth() {
  return useContext(AuthContext);
}
