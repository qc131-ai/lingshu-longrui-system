import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { authService, type AuthUser, type UserRole } from '../services/authService';

type AuthContextType = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = 'astralink.auth.token';
const USER_KEY = 'astralink.auth.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) as AuthUser : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    authService.me()
      .then(({ user }) => {
        setUser(user);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      });
  }, [token]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login: async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const result = await authService.login(email, password);
        setToken(result.token);
        setUser(result.user);
        localStorage.setItem(TOKEN_KEY, result.token);
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        toast.success(`欢迎回来，${result.user.displayName}`);
      } finally {
        setIsLoading(false);
      }
    },
    logout: async () => {
      await authService.logout().catch(() => undefined);
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
      toast.success('已退出登录');
    },
    hasRole: (...roles: UserRole[]) => Boolean(user && roles.includes(user.role)),
  }), [isLoading, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
