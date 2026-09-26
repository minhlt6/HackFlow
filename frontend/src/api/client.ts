import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  // FIX BUG-02: Xóa withCredentials — đang dùng localStorage Bearer token, không phải httpOnly cookie
  // Dùng cả hai song song gây mixed auth strategy — localStorage không bảo vệ khỏi XSS
  // withCredentials: true,  ← đã xóa
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('hackflow_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// FIX BUG-22: Guard flag — đảm bảo chỉ redirect 1 lần khi nhiều request đồng thời nhận 401
let _isRedirecting = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('hackflow_token');

      // Import động để tránh circular dependency
      import('../store/authStore').then(({ useAuthStore }) => {
        const { isAuthenticated } = useAuthStore.getState();
        // FIX BUG-22: Chỉ trigger logout+redirect một lần, không gọi nhiều lần đồng thời
        if (isAuthenticated && !_isRedirecting) {
          _isRedirecting = true;
          useAuthStore.getState().logout();
          const currentPath = window.location.pathname;
          if (currentPath !== '/login') {
            window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
          }
          // Reset sau khi redirect xong
          setTimeout(() => { _isRedirecting = false; }, 3000);
        }
      });
    }
    return Promise.reject(error);
  }
);
