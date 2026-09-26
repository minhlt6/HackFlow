import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Danh sách role được phép truy cập route này. Nếu không truyền → chỉ cần đăng nhập. */
  allowedRoles?: UserRole[];
  /** Nếu true → redirect về / khi đã đăng nhập (dùng cho /login) */
  redirectIfAuthenticated?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  redirectIfAuthenticated = false,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  // Đang kiểm tra auth → hiện spinner
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400" />
      </div>
    );
  }

  // Route dành cho guest (VD: /login) — redirect về / nếu đã đăng nhập
  if (redirectIfAuthenticated && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Route yêu cầu đăng nhập → redirect về /login
  if (!redirectIfAuthenticated && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // FIX BUG-01: Không đặt <Navigate> bên trong JSX block — gây redirect ngay lập tức + UI flash
  // Chỉ cần redirect về trang chủ; thông báo lỗi để ProtectedRoute xử lý ở layout level
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
