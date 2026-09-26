import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  fetchCurrentUser: () => Promise<void>;
  quickLogin: (email: string) => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('hackflow_token'),
  isAuthenticated: !!localStorage.getItem('hackflow_token'),
  isLoading: true,

  login: (token: string, user: User) => {
    localStorage.setItem('hackflow_token', token);
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('hackflow_token');
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  fetchCurrentUser: async () => {
    try {
      const token = localStorage.getItem('hackflow_token');
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      const res = await apiClient.get('/users/me');
      if (res.data?.success) {
        set({ user: res.data.data, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      localStorage.removeItem('hackflow_token');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  quickLogin: async (roleOrEmail: string) => {
    try {
      let role = 'participant';
      const lower = roleOrEmail.toLowerCase();
      if (lower.includes('admin')) role = 'admin';
      else if (lower.includes('judge')) role = 'judge';
      else if (lower.includes('mentor')) role = 'mentor';
      else if (lower.includes('leader')) role = 'leader';
      else if (lower.includes('member')) role = 'member';

      let res;
      // 1. Ưu tiên endpoint dev-login một chạm trực tiếp từ backend (không cần password)
      try {
        res = await apiClient.post('/auth/dev-login', { role });
      } catch (e) {
        // Fallback sang /auth/login truyền thống nếu endpoint dev-login chưa sẵn sàng
        let email = roleOrEmail;
        if (!email.includes('@')) {
          if (role === 'admin') email = 'admin@hackflow.local';
          else if (role === 'judge') email = 'judge@hackflow.local';
          else if (role === 'mentor') email = 'mentor@hackflow.local';
          else if (role === 'member') email = 'member1@hackflow.local';
          else email = 'leader@hackflow.local';
        }
        let password = 'User@123';
        if (email.includes('admin')) password = 'Admin@123';
        else if (email.includes('mentor')) password = 'Mentor@123';
        else if (email.includes('judge')) password = 'Judge@123';

        res = await apiClient.post('/auth/login', { email, password });
      }

      if (res?.data?.success) {
        const { access_token } = res.data.data;
        localStorage.setItem('hackflow_token', access_token);
        try {
          const meRes = await apiClient.get('/users/me');
          if (meRes.data?.success) {
            set({
              token: access_token,
              user: meRes.data.data,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          }
          localStorage.removeItem('hackflow_token');
          return false;
        } catch {
          localStorage.removeItem('hackflow_token');
          return false;
        }
      }
      return false;
    } catch (err) {
      console.error('Quick login failed', err);
      return false;
    }
  },
}));
