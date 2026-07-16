import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Layers, 
  Calendar, 
  UserSquare2, 
  Wallet,
  Menu,
  X,
  History,
  Clock,
  Trophy,
  FileText,
  Bot,
  FileSpreadsheet,
  ClipboardList,
  Settings
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';
import { roleLabels } from '../../auth/permissions';
import type { UserRole } from '../../services/authService';

const navigation: Array<{ name: string; href: string; icon: typeof LayoutDashboard; roles: UserRole[] }> = [
  { name: '首页看板', href: '/', icon: LayoutDashboard, roles: ['admin', 'academic_manager', 'advisor', 'teacher', 'finance'] },
  { name: '学员管理', href: '/students', icon: Users, roles: ['admin', 'academic_manager', 'advisor'] },
  { name: '课程产品', href: '/courses', icon: BookOpen, roles: ['admin', 'academic_manager'] },
  { name: '班级管理', href: '/classes', icon: Layers, roles: ['admin', 'academic_manager'] },
  { name: '排课日历', href: '/schedule', icon: Calendar, roles: ['admin', 'academic_manager', 'teacher'] },
  { name: '上课记录', href: '/records', icon: History, roles: ['admin', 'academic_manager', 'teacher'] },
  { name: '请假补课', href: '/leaves', icon: Clock, roles: ['admin', 'academic_manager'] },
  { name: '老师中心', href: '/teachers', icon: UserSquare2, roles: ['admin', 'academic_manager'] },
  { name: '作业测评', href: '/assessments', icon: FileText, roles: ['admin', 'teacher'] },
  { name: '竞赛项目', href: '/competitions', icon: Trophy, roles: ['admin'] },
  { name: '家长报告', href: '/reports', icon: FileText, roles: ['admin', 'academic_manager', 'advisor'] },
  { name: '订单课时', href: '/orders', icon: Wallet, roles: ['admin', 'advisor', 'finance'] },
  { name: '财务概览', href: '/finance', icon: Wallet, roles: ['admin', 'finance'] },
  { name: '数据导入', href: '/data-import', icon: FileSpreadsheet, roles: ['admin', 'academic_manager', 'advisor', 'teacher', 'finance'] },
  { name: 'AI 教务助手', href: '/ai', icon: Bot, roles: ['admin', 'academic_manager', 'advisor', 'teacher', 'finance'] },
  { name: 'AI 任务中心', href: '/ai-tasks', icon: ClipboardList, roles: ['admin', 'academic_manager', 'advisor'] },
  { name: '系统设置', href: '/settings', icon: Settings, roles: ['admin', 'academic_manager'] },
];

export function Sidebar({ mobileMenuOpen, setMobileMenuOpen }: { mobileMenuOpen: boolean, setMobileMenuOpen: (open: boolean) => void }) {
  const { user, logout } = useAuth();
  const visibleNavigation = navigation.filter((item) => item.roles.includes(user?.role as UserRole));

  return (
    <>
      {/* Mobile background overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-900/80 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar component */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:flex lg:flex-col",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between px-6 bg-gray-950">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-lg">A</div>
            <span className="text-lg font-bold">Astralink</span>
          </div>
          <button 
            type="button" 
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {visibleNavigation.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-blue-600 text-white" 
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 bg-gray-950 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="font-medium text-sm">LD</span>
            </div>
            <div>
              <div className="text-sm font-medium text-white">{user?.displayName ?? '未登录'}</div>
              <div className="text-xs text-gray-400">{user ? roleLabels[user.role] : 'Guest'} · {user?.organization.name ?? ''}</div>
            </div>
          </div>
          <button onClick={logout} className="mt-3 w-full text-left text-xs text-gray-400 hover:text-white">
            退出登录
          </button>
        </div>
      </div>
    </>
  );
}
