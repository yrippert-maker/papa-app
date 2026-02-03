'use client';

import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/shell/Topbar';
import { useSidebar } from '@/components/context/SidebarContext';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col transition-[margin] duration-300 ${
          collapsed ? 'ml-20' : 'ml-64'
        }`}
      >
        <Topbar />
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
