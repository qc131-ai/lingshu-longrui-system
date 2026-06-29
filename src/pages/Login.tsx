import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const demoAccounts = [
  ['admin@longrui.com', 'admin123', '管理员'],
  ['academic@longrui.com', 'academic123', '教务主管'],
  ['advisor@longrui.com', 'advisor123', '顾问'],
  ['teacher@longrui.com', 'teacher123', '老师'],
  ['finance@longrui.com', 'finance123', '财务'],
] as const;

export function Login() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@longrui.com');
  const [password, setPassword] = useState('admin123');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      toast.error('登录失败，请检查测试账号和密码');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
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
          <p className="text-xs text-gray-500 mb-2">测试账号</p>
          <div className="space-y-1">
            {demoAccounts.map(([account, pwd, label]) => (
              <button
                key={account}
                type="button"
                onClick={() => { setEmail(account); setPassword(pwd); }}
                className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 text-gray-600"
              >
                {label} · {account} / {pwd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
