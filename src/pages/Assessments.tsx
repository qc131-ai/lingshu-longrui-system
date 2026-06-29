import { useState } from 'react';
import { Search, Filter, BookOpen, Trophy, TrendingUp, AlertCircle, FileText, Sparkles, Plus } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { lessonService } from '../services/lessonService';

const assessmentTabs = lessonService.getAssessmentTabsSync();
const assessmentChartData = lessonService.getAssessmentChartDataSync();
const assessmentWeakPointTags = lessonService.getAssessmentWeakPointTagsSync();

export function Assessments() {
  const { assessments } = useAppContext();
  const [activeTab, setActiveTab] = useState('作业管理');
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">作业测评</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          布置作业/测评
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {assessmentTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === '作业管理' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索学生、课程或作业名称..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
                <Filter className="w-4 h-4" />
                提交状态
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-4">学生/课程</th>
                  <th scope="col" className="px-6 py-4">作业名称</th>
                  <th scope="col" className="px-6 py-4">布置老师</th>
                  <th scope="col" className="px-6 py-4">截止时间</th>
                  <th scope="col" className="px-6 py-4">提交状态</th>
                  <th scope="col" className="px-6 py-4">批改状态/得分</th>
                  <th scope="col" className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((record) => (
                  <tr key={record.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{record.studentName}</div>
                      <div className="text-xs text-gray-500">{record.courseName}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {record.title}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {record.teacherName}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {record.dueDate}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full
                        ${record.submitStatus === 'submitted' ? 'bg-green-100 text-green-700' : 
                          record.submitStatus === 'pending' ? 'bg-orange-100 text-orange-700' : 
                          'bg-red-100 text-red-700'}`}>
                        {record.submitStatus === 'submitted' ? '已提交' : 
                         record.submitStatus === 'pending' ? '待提交' : '已逾期'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       {record.gradeStatus === 'graded' ? (
                          <span className="font-bold text-blue-600">{record.score} 分</span>
                       ) : (
                          <span className="text-gray-400">待批改</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        {record.gradeStatus === 'graded' ? '查看详情' : '去批改'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === '成绩趋势' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">综合成绩趋势</h3>
              <select className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg p-2">
                <option>全部学科</option>
                <option>AP微积分</option>
                <option>托福阅读</option>
              </select>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={assessmentChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066ff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0066ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} domain={[0, 100]} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="score" stroke="#0066ff" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="bg-purple-50 p-6 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-32 h-32 text-purple-600" />
                </div>
                <div className="relative z-10">
                  <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    AI 薄弱点分析总结
                  </h4>
                  <div className="space-y-3">
                    <div className="bg-white/60 p-3 rounded-lg border border-purple-100">
                      <p className="text-sm font-medium text-purple-900 mb-1">理科类表现</p>
                      <p className="text-xs text-purple-800">AP微积分积分应用部分正确率偏低 (65%)，建议补充针对性练习。</p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-lg border border-purple-100">
                      <p className="text-sm font-medium text-purple-900 mb-1">语言类表现</p>
                      <p className="text-xs text-purple-800">托福听力细节题得分率提升明显，已达到 85% 目标线。</p>
                    </div>
                  </div>
                  <button className="mt-4 w-full bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm px-4 py-2 transition-colors">
                    生成完整提分建议
                  </button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
               <h4 className="font-bold text-gray-900 mb-4">高频错题标签</h4>
               <div className="flex flex-wrap gap-2">
                 {assessmentWeakPointTags.map((tag, index) => {
                   const styles = [
                     'bg-red-50 text-red-700 border-red-100',
                     'bg-orange-50 text-orange-700 border-orange-100',
                     'bg-yellow-50 text-yellow-700 border-yellow-100',
                     'bg-gray-50 text-gray-700 border-gray-200',
                   ];
                   return (
                     <span key={tag} className={`px-2.5 py-1 text-xs font-medium rounded-md border ${styles[index] ?? styles[3]}`}>{tag}</span>
                   );
                 })}
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab !== '作业管理' && activeTab !== '成绩趋势' && (
        <div className="py-12 text-center text-gray-500">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>此模块正在开发中...</p>
        </div>
      )}
    </div>
  );
}
