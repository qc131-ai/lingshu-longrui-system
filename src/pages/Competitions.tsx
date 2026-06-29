import { useState } from 'react';
import { Search, Filter, Trophy, Target, Calendar as CalendarIcon, FileUp, ChevronRight, Plus } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { competitionService } from '../services/competitionService';

const competitionsPageStats = competitionService.getPageStatsSync();

export function Competitions() {
  const { competitions } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'enrolled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">已报名报名</span>;
      case 'training': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">集训中</span>;
      case 'preliminary': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">初赛备战</span>;
      case 'final': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">决赛冲刺</span>;
      case 'completed': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">已完赛</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">竞赛项目</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          新建竞赛项目
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">活跃项目</p>
               <h3 className="text-2xl font-bold text-gray-900 mt-1">{competitionsPageStats.activeProjects}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
               <Trophy className="w-5 h-5 text-blue-600" />
             </div>
           </div>
         </div>
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">即将截止报名</p>
               <h3 className="text-2xl font-bold text-orange-600 mt-1">{competitionsPageStats.upcomingDeadlines}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
               <CalendarIcon className="w-5 h-5 text-orange-600" />
             </div>
           </div>
         </div>
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">本月完赛</p>
               <h3 className="text-2xl font-bold text-green-600 mt-1">{competitionsPageStats.completedThisMonth}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
               <Target className="w-5 h-5 text-green-600" />
             </div>
           </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索竞赛名称、学生..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              项目状态
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">竞赛项目</th>
                <th scope="col" className="px-6 py-4">指导老师</th>
                <th scope="col" className="px-6 py-4">当前阶段</th>
                <th scope="col" className="px-6 py-4">报名截止</th>
                <th scope="col" className="px-6 py-4">下一个节点</th>
                <th scope="col" className="px-6 py-4">训练进度</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {competitions.map((comp) => (
                <tr key={comp.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-900">{comp.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">参赛学生: {comp.studentName}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">
                    {comp.advisor}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(comp.status)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {comp.deadline}
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-blue-600 font-medium">{comp.nextMilestone}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden w-24">
                        <div 
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${comp.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                        {comp.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm inline-flex items-center">
                      项目详情 <ChevronRight className="w-4 h-4 ml-0.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
