/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { Students } from './pages/Students';
import { Courses } from './pages/Courses';
import { Classes } from './pages/Classes';
import { Schedule } from './pages/Schedule';
import { Teachers } from './pages/Teachers';
import { Finance } from './pages/Finance';

// Dummy imports for now, will create these files next
import { Records } from './pages/Records';
import { Leaves } from './pages/Leaves';
import { Assessments } from './pages/Assessments';
import { Competitions } from './pages/Competitions';
import { Reports } from './pages/Reports';
import { Orders } from './pages/Orders';
import { AIAssistant } from './pages/AIAssistant';
import { AITasks } from './pages/AITasks';
import { DataImport } from './pages/DataImport';
import { SystemSettings } from './pages/SystemSettings';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import type { UserRole } from './services/authService';
import type { ReactNode } from 'react';

function GuardedPage({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">
        当前账号暂无权限访问该页面
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="students" element={<GuardedPage roles={['admin', 'academic_manager', 'advisor']}><Students /></GuardedPage>} />
        <Route path="courses" element={<GuardedPage roles={['admin', 'academic_manager']}><Courses /></GuardedPage>} />
        <Route path="classes" element={<GuardedPage roles={['admin', 'academic_manager']}><Classes /></GuardedPage>} />
        <Route path="schedule" element={<GuardedPage roles={['admin', 'academic_manager', 'teacher']}><Schedule /></GuardedPage>} />
        <Route path="records" element={<GuardedPage roles={['admin', 'academic_manager', 'teacher']}><Records /></GuardedPage>} />
        <Route path="leaves" element={<GuardedPage roles={['admin', 'academic_manager']}><Leaves /></GuardedPage>} />
        <Route path="teachers" element={<GuardedPage roles={['admin', 'academic_manager']}><Teachers /></GuardedPage>} />
        <Route path="assessments" element={<GuardedPage roles={['admin', 'teacher']}><Assessments /></GuardedPage>} />
        <Route path="competitions" element={<GuardedPage roles={['admin']}><Competitions /></GuardedPage>} />
        <Route path="reports" element={<GuardedPage roles={['admin', 'academic_manager', 'advisor']}><Reports /></GuardedPage>} />
        <Route path="orders" element={<GuardedPage roles={['admin', 'advisor', 'finance']}><Orders /></GuardedPage>} />
        <Route path="finance" element={<GuardedPage roles={['admin', 'finance']}><Finance /></GuardedPage>} />
        <Route path="ai" element={<GuardedPage roles={['admin', 'academic_manager', 'advisor', 'teacher', 'finance']}><AIAssistant /></GuardedPage>} />
        <Route path="ai-tasks" element={<GuardedPage roles={['admin', 'academic_manager', 'advisor']}><AITasks /></GuardedPage>} />
        <Route path="data-import" element={<GuardedPage roles={['admin', 'academic_manager', 'advisor', 'teacher', 'finance']}><DataImport /></GuardedPage>} />
        <Route path="settings" element={<GuardedPage roles={['admin', 'academic_manager']}><SystemSettings /></GuardedPage>} />
      </Route>
    </Routes>
  );
}
