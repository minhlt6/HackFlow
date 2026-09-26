import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { QuickRoleSwitcher } from '../common/QuickRoleSwitcher';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Trang đăng nhập / đăng ký (/login) hiển thị standalone không có Sidebar hay Header nội bộ
  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex selection:bg-blue-600 selection:text-white">
      {/* Desktop Sidebar: Always visible on md and up */}
      <div className="hidden md:block shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay & Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Sidebar Drawer */}
          <div className="relative z-10 w-64 max-w-[80vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Right Area: TopHeader + Page Content + Footer */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          mobileSidebarOpen={mobileSidebarOpen}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-700">VinUni AI HackFlow</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600 font-medium">Chương trình Đào tạo Nhân tài AI Thực chiến (VinUni x Vingroup)</span>
            </div>
            <div className="font-mono text-[11px] text-slate-500">
              SFIA Framework • 12-Week AI Bootcamp • Blind Rubric Evaluation
            </div>
          </div>
        </footer>

        {/* 1-Click Role Switcher bar for testing and evaluation */}
        <QuickRoleSwitcher />
      </div>
    </div>
  );
};
