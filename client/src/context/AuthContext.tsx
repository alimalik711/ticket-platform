import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../services/api";
import type { User, Reservation } from "../types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  activeHoldCount: number;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshReservations: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeHoldCount, setActiveHoldCount] = useState(0);

  const refreshReservations = useCallback(async () => {
    if (!user) {
      setActiveHoldCount(0);
      return;
    }
    try {
      const res = await api.reservations.list();
      const now = new Date();
      const activeHolds = res.filter(
        (r: Reservation) => r.status === "HELD" && new Date(r.expires_at) > now,
      );
      setActiveHoldCount(activeHolds.length);
    } catch {
      setActiveHoldCount(0);
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      // First try /api/v1/auth/me which uses requireAuth and better-auth session
      const currentUser = await api.auth.getMe();
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Fallback to getSession
        const sessionData = await api.auth.getSession();
        if (sessionData && sessionData.user) {
          setUser(sessionData.user);
        } else {
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (user) {
      refreshReservations();
      // Poll active reservations every 30 seconds
      const interval = setInterval(refreshReservations, 30000);
      return () => clearInterval(interval);
    } else {
      setActiveHoldCount(0);
    }
  }, [user, refreshReservations]);

  const login = async (email: string, password: string) => {
    await api.auth.signIn({ email, password });
    await refreshUser();
  };

  const register = async (name: string, email: string, password: string) => {
    await api.auth.signUp({ name, email, password });
    await refreshUser();
  };

  const logout = async () => {
    try {
      await api.auth.signOut();
    } finally {
      setUser(null);
      setActiveHoldCount(0);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        activeHoldCount,
        login,
        register,
        logout,
        refreshUser,
        refreshReservations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
