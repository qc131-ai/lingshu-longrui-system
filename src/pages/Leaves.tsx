import { useState } from 'react';
import { Search, Filter, Calendar as CalendarIcon, UserX, CheckCircle2, XCircle, RefreshCw, Bell, Clock, ChevronRight, X } from 'lucide-react';
import { LeaveRecord } from '../types';
import { useAppContext } from '../context/AppContext';
import { lessonService } from '../services/lessonService';

const leavesPageStats = lessonService.getLeavesPageStatsSync();

export function Leaves() {
  const { leaveRecords } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<LeaveRecord | null>(null);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">已同意</span>;
      case 'pending': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">待审批</span>;
      case 'rejected': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">已拒绝</span>;
      case 'makeup_scheduled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">补课已排</span>;
      case 'makeup_completed': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">补课完成</span>;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'student_leave': return <span className="px-2 py-1 text-xs font-medium rounded bg-orange-50 text-orange-600 border border-orange-100">学生请假</span>;
      case 'teacher_leave': return <span className="px-2 py-1 text-xs font-medium rounded bg-purple-50 text-purple-600 border border-purple-100">老师请假</span>;
      case 'reschedule': return <span className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 border border-blue-100">临时调课</span>;
      case 'cancel': return <span className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-600 border border-red-100">课程取消</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">请假补课</h1>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
          发起申请
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">待审批申请</p>
              <h3 className="text-2xl font-bold text-orange-600 mt-1">{leavesPageStats.pendingApproval}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">待安排补课</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{leavesPageStats.pendingMakeup}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">本周调课</p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">{leavesPageStats.weeklyReschedule}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">已完成补课</p>
              <h3 className="text-2xl font-bold text-green-600 mt-1">{leavesPageStats.completedMakeup}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
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
              placeholder="搜索申请人、课程名..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              类型
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
              <Filter className="w-4 h-4" />
              状态
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">类型</th>
                <th scope="col" className="px-6 py-4">申请人/课程</th>
                <th scope="col" className="px-6 py-4">原上课时间</th>
                <th scope="col" className="px-6 py-4">原因</th>
                <th scope="col" className="px-6 py-4">扣课时</th>
                <th scope="col" className="px-6 py-4">状态</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {leaveRecords.map((record) => (
                <tr 
                  key={record.id} 
                  className="bg-white border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedRecord(record)}
                >
                  <td className="px-6 py-4">
                    {getTypeBadge(record.type)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{record.studentName || record.teacherName}</div>
                    <div className="text-xs text-gray-500">{record.className}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {record.originalDate}
                  </td>
                  <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]">
                    {record.reason}
                  </td>
                  <td className="px-6 py-4">
                    {record.deductCredit ? <span className="text-red-600 font-medium">是</span> : <span className="text-gray-400">否</span>}
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(record.status)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-end w-full">
                      处理 <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedRecord && (
        <>
          <div 
            className="fixed inset-0 bg-gray-900/30 z-40 transition-opacity"
            onClick={() => setSelectedRecord(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-gray-50 shadow-2xl z-50 transform transition-transform duration-300 flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-gray-900">请假/调课处理</h2>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Progress Tracker */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative">
                <div className="absolute top-8 left-10 right-10 h-0.5 bg-gray-200 z-0"></div>
                <div className="absolute top-8 left-10 w-1/2 h-0.5 bg-blue-600 z-0"></div>
                
                <div className="relative z-10 flex justify-between text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">1</div>
                    <span className="text-xs font-medium text-gray-900">申请提交</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-4 ring-white">2</div>
                    <span className="text-xs font-medium text-gray-900">教务审批</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold ring-4 ring-white">3</div>
                    <span className="text-xs font-medium text-gray-500">补课安排</span>
                  </div>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                  {getTypeBadge(selectedRecord.type)}
                  <span className="font-bold text-gray-900">{selectedRecord.studentName || selectedRecord.teacherName}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-gray-500 mb-1">关联课程</span>
                    <span className="font-medium text-gray-900">{selectedRecord.className}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-1">原上课时间</span>
                    <span className="font-medium text-gray-900">{selectedRecord.originalDate}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-gray-500 mb-1">申请原因</span>
                    <div className="bg-gray-50 p-3 rounded-lg text-gray-700">
                      {selectedRecord.reason}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Form */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h4 className="font-bold text-gray-900">审批与处理</h4>
                
                <div className="flex gap-3">
                  <button className="flex-1 py-2 bg-green-50 text-green-700 font-medium rounded-lg border border-green-200 hover:bg-green-100 flex justify-center items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> 批准申请
                  </button>
                  <button className="flex-1 py-2 bg-red-50 text-red-700 font-medium rounded-lg border border-red-200 hover:bg-red-100 flex justify-center items-center gap-2">
                    <XCircle className="w-4 h-4" /> 拒绝申请
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">课时处理</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" name="credit" className="text-blue-600 focus:ring-blue-500" defaultChecked={!selectedRecord.deductCredit} />
                        不扣课时，安排补课
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" name="credit" className="text-blue-600 focus:ring-blue-500" defaultChecked={selectedRecord.deductCredit} />
                        直接扣除课时
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">补课安排 (如需)</label>
                    <div className="flex gap-2">
                      <input type="datetime-local" className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2" />
                      <button className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100">
                        AI 推荐时间
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" defaultChecked />
                      <Bell className="w-4 h-4 text-gray-400" /> 处理完成后自动通知家长和老师
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                确认处理
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
