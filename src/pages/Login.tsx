import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../services/apiClient';

const accountRoles = [
  { key: 'admin', emailPrefix: 'admin', password: 'admin123', role: '管理员', description: '查看全部模块、管理账号和系统设置' },
  { key: 'academic', emailPrefix: 'academic', password: 'academic123', role: '教务主管', description: '查看教务数据、排课、上课记录和报告' },
  { key: 'advisor', emailPrefix: 'advisor', password: 'advisor123', role: '顾问', description: '查看负责学员、课时状态和家长沟通' },
  { key: 'teacher', emailPrefix: 'teacher', password: 'teacher123', role: '老师', description: '查看本人课程并提交老师反馈' },
  { key: 'finance', emailPrefix: 'finance', password: 'finance123', role: '财务', description: '查看订单课时、课时流水和导出数据' },
] as const;

const demoOrganizations = [
  { code: 'longrui', name: '朗睿教育', suffix: 'longrui.com' },
  { code: 'wolai', name: '我来教育', suffix: 'wolai.com' },
  { code: 'guangwai', name: '广外留学', suffix: 'guangwai.com' },
  { code: 'amazingx', name: 'AmazingX', suffix: 'amazingx.com' },
] as const;

export function Login() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@longrui.com');
  const [password, setPassword] = useState('admin123');
  const [selectedOrg, setSelectedOrg] = useState<(typeof demoOrganizations)[number]['code']>('longrui');
  const activeOrg = demoOrganizations.find((org) => org.code === selectedOrg) ?? demoOrganizations[0];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (error) {
      if (error instanceof ApiClientError) {
        toast.error(error.message || '登录失败，请检查账号状态');
      } else if (error instanceof TypeError) {
        toast.error('后端未连接，请确认后端服务已启动');
      } else {
        toast.error('登录失败，请检查测试账号和密码');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-xl">A</div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Astralink 灵枢教务</h1>
            <p className="text-sm text-gray-500">朗睿教育 Staging 登录</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-blue-500 focus:border-blue-500" />
          </div>
          <button disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-60">
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-500 mb-2">机构 Demo 账号</p>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {demoOrganizations.map((org) => (
              <button
                key={org.code}
                type="button"
                onClick={() => setSelectedOrg(org.code)}
                className={`rounded-md px-2 py-1.5 text-xs border ${selectedOrg === org.code ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
              >
                {org.name}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {accountRoles.map((account) => {
              const accountEmail = `${account.emailPrefix}@${activeOrg.suffix}`;
              return (
              <div key={`${activeOrg.code}-${account.key}`} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{activeOrg.name} · {account.role}</p>
                    <p className="text-xs text-gray-500 mt-0.5 break-all">{accountEmail} / {account.password}</p>
                    <p className="text-xs text-gray-400 mt-1">{account.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEmail(accountEmail); setPassword(account.password); }}
                    className="shrink-0 text-xs px-2.5 py-1.5 rounded border border-blue-100 text-blue-600 hover:bg-blue-50"
                  >
                    一键填入
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
