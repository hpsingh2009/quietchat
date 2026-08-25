import { create } from 'zustand';
import { User } from 'firebase/auth';

export interface DbUser {
  id: number;
  uid: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  bio: string | null;
}

interface AuthState {
  user: User | null;
  dbUser: DbUser | null;
  token: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setDbUser: (dbUser: DbUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  dbUser: null,
  token: null,
  loading: true,
  setUser: (user) => set({ user }),
  setDbUser: (dbUser) => set({ dbUser }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ loading }),
}));
