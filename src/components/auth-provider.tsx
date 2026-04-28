import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  AuthError,
  clearAuthSession,
  confirmSignup as apiConfirmSignup,
  deleteProfilePhoto as apiDeleteProfilePhoto,
  getAuthToken,
  getMe,
  getStoredUser,
  login as apiLogin,
  logoutRequest,
  refreshAccessToken,
  sendSignupCode as apiSendSignupCode,
  uploadProfilePhoto as apiUploadProfilePhoto,
  type AuthUser,
  type SendCodeResponse,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  login: (input: { identifier: string; password: string }) => Promise<AuthUser>;
  sendSignupCode: (input: { email: string; username: string }) => Promise<SendCodeResponse>;
  confirmSignup: (input: {
    email: string;
    username: string;
    password: string;
    code: string;
  }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  updateProfilePhoto: (file: File) => Promise<AuthUser>;
  removeProfilePhoto: () => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [loading, setLoading] = useState<boolean>(true);

  // On mount, verify session against backend.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch (e) {
        if (e instanceof AuthError && e.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            try {
              const me = await getMe();
              if (!cancelled) setUser(me);
            } catch {
              clearAuthSession();
              if (!cancelled) setUser(null);
            }
          } else {
            clearAuthSession();
            if (!cancelled) setUser(null);
          }
        } else {
          // Network or other error: keep the stored user optimistically.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: { identifier: string; password: string }) => {
    const res = await apiLogin(input);
    setUser(res.user);
    return res.user;
  }, []);

  const sendSignupCode = useCallback(
    async (input: { email: string; username: string }) => apiSendSignupCode(input),
    [],
  );

  const confirmSignup = useCallback(
    async (input: { email: string; username: string; password: string; code: string }) => {
      const res = await apiConfirmSignup(input);
      setUser(res.user);
      return res.user;
    },
    [],
  );

  const logout = useCallback(async () => {
    await logoutRequest();
    clearAuthSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const updateProfilePhoto = useCallback(async (file: File) => {
    const me = await apiUploadProfilePhoto(file);
    setUser(me);
    return me;
  }, []);

  const removeProfilePhoto = useCallback(async () => {
    const me = await apiDeleteProfilePhoto();
    setUser(me);
    return me;
  }, []);

  const isAuthenticated = !!user && !!getAuthToken();
  const value: AuthContextValue = {
    user,
    loading,
    isAuthenticated,
    isGuest: !isAuthenticated,
    login,
    sendSignupCode,
    confirmSignup,
    logout,
    refreshUser,
    updateProfilePhoto,
    removeProfilePhoto,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
