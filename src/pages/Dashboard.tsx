import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { reportService } from '../services/reportService';

const dashboardKpiStats = reportService.getDashboardKpiStatsSync();
const dashboardChartData = reportService.getDashboardChartSync();
const dashboardTasks = reportService.getDashboardTasksSync();

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据看板</h1>
          <p className="mt-1 text-sm text-gray-500">欢迎回来，以下是今天的教务概览。</p>
        </div>
        <div className="flex gap-3">
          <select className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5">
            <option>本周</option>
            <option>本月</option>
            <option>本季度</option>
            <option>今年</option>
          </select>
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5">
            导出报表
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">在读学员</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{dashboardKpiStats.activeStudents}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {dashboardKpiStats.activeStudentsGrowth}
            </span>
            <span className="text-gray-400 ml-2">较上月</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">活跃班级</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{dashboardKpiStats.activeClasses}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-600 font-medium flex items-center">
              新增 {dashboardKpiStats.newClassesThisWeek} 个
            </span>
            <span className="text-gray-400 ml-2">本周</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">今日课耗 (小时)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{dashboardKpiStats.todayLessonHours}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-600 font-medium flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {dashboardKpiStats.todayLessonGrowth}
            </span>
            <span className="text-gray-400 ml-2">较昨日</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">续费预警</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{dashboardKpiStats.renewalWarnings}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-red-500 font-medium flex items-center">
              需本周跟进
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">营收趋势</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066ff" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0066ff" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-6">新增学员分布</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{fill: '#F3F4F6'}}
                />
                <Bar dataKey="students" fill="#4648d4" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* 待办事项列表等 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">今日待办事项</h3>
        <div className="space-y-4">
          {dashboardTasks.map((task, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">{task.title}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500">{task.time}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${task.type === 'urgent' ? 'bg-red-50 text-red-600' : 
                    task.type === 'warning' ? 'bg-orange-50 text-orange-600' : 
                    'bg-blue-50 text-blue-600'}`}>
                  {task.type === 'urgent' ? '紧急' : task.type === 'warning' ? '重要' : '常规'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
