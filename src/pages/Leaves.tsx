import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Calendar as CalendarIcon, UserX, CheckCircle2, XCircle, RefreshCw, Bell, Clock, ChevronRight, X } from 'lucide-react';
import { LeaveRecord } from '../types';
import { useAppContext } from '../context/AppContext';
import { leaveMakeupService } from '../services/leaveMakeupService';
import toast from 'react-hot-toast';

export function Leaves() {
  const { leaveRecords: initialLeaveRecords, teachers, students } = useAppContext();
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(initialLeaveRecords);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<LeaveRecord | null>(null);
  const [filters, setFilters] = useState({ requestType: '', status: '', teacherId: '', studentId: '', startDate: '', endDate: '' });
  const [isLoading, setIsLoading] = useState(false);

  const leavesPageStats = useMemo(() => ({
    pendingApproval: leaveRecords.filter(item => item.status === 'pending').length,
    pendingMakeup: leaveRecords.filter(item => item.status === 'makeup_pending' || item.status === 'approved').length,
    weeklyReschedule: leaveRecords.filter(item => item.type === 'reschedule' || item.requestType === 'reschedule').length,
    completedMakeup: leaveRecords.filter(item => item.status === 'completed' || item.status === 'makeup_completed').length,
  }), [leaveRecords]);

  const visibleRecords = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return leaveRecords;
    return leaveRecords.filter(record => [record.studentName, record.teacherName, record.className, record.courseName, record.reason].some(value => value?.toLowerCase().includes(keyword)));
  }, [leaveRecords, searchTerm]);

  const refreshLeaves = async () => {
    setIsLoading(true);
    try {
      const latest = await leaveMakeupService.list(filters);
      setLeaveRecords(latest);
    } catch (error) {
      toast.error(`请假补课加载失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshLeaves();
  }, [filters.requestType, filters.status, filters.teacherId, filters.studentId, filters.startDate, filters.endDate]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">已同意</span>;
      case 'pending': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">待审批</span>;
      case 'rejected': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">已拒绝</span>;
      case 'makeup_pending': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">待安排补课</span>;
      case 'makeup_scheduled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">补课已排</span>;
      case 'makeup_completed': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">补课完成</span>;
      case 'completed': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">已完成</span>;
      case 'parent_notified': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700">已通知家长</span>;
      case 'cancelled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">已取消</span>;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch(type) {
      case 'student_leave': return <span className="px-2 py-1 text-xs font-medium rounded bg-orange-50 text-orange-600 border border-orange-100">学生请假</span>;
      case 'teacher_leave': return <span className="px-2 py-1 text-xs font-medium rounded bg-purple-50 text-purple-600 border border-purple-100">老师请假</span>;
      case 'reschedule': return <span className="px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 border border-blue-100">临时调课</span>;
      case 'cancel': return <span className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-600 border border-red-100">课程取消</span>;
      case 'cancellation': return <span className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-600 border border-red-100">课程取消</span>;
      case 'makeup': return <span className="px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-600 border border-green-100">补课安排</span>;
      default: return null;
    }
  };

  const handleCreate = async () => {
    const scheduleId = window.prompt('请输入原排课 scheduleId');
    if (!scheduleId) return;
    const requestType = (window.prompt('申请类型：student_leave / teacher_leave / reschedule / cancellation / makeup', 'student_leave') || 'student_leave') as 'student_leave';
    const reason = window.prompt('请输入申请原因');
    if (!reason) return;
    try {
      const created = await leaveMakeupService.create({ scheduleId, requestType, reason });
      setLeaveRecords(prev => [created, ...prev]);
      toast.success('请假补课申请已创建');
    } catch (error) {
      toast.error(`创建失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const updateSelected = (updated: LeaveRecord) => {
    setSelectedRecord(updated);
    setLeaveRecords(prev => prev.map(item => item.id === updated.id ? updated : item));
  };

  const handleApprove = async () => {
    if (!selectedRecord) return;
    try {
      updateSelected(await leaveMakeupService.approve(selectedRecord.id, window.prompt('审批备注（可选）') || undefined));
      toast.success('审批已通过');
    } catch (error) {
      toast.error(`审批失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleReject = async () => {
    if (!selectedRecord) return;
    const rejectReason = window.prompt('请输入拒绝原因');
    if (!rejectReason) return;
    try {
      updateSelected(await leaveMakeupService.reject(selectedRecord.id, rejectReason));
      toast.success('申请已拒绝');
    } catch (error) {
      toast.error(`拒绝失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleScheduleMakeup = async () => {
    if (!selectedRecord) return;
    const date = window.prompt('补课日期 YYYY-MM-DD', selectedRecord.newDate || selectedRecord.originalDate);
    const startTime = window.prompt('开始时间 HH:mm', selectedRecord.newStartTime || '10:00');
    const endTime = window.prompt('结束时间 HH:mm', selectedRecord.newEndTime || '12:00');
    if (!date || !startTime || !endTime) return;
    try {
      const result = await leaveMakeupService.scheduleMakeup(selectedRecord.id, { date, startTime, endTime, teacherId: selectedRecord.teacherId, classroom: 'Makeup Room', notes: '请假补课安排' });
      updateSelected(result.request);
      toast.success('补课已安排');
    } catch (error) {
      toast.error(`安排补课失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleNotifyParent = async () => {
    if (!selectedRecord) return;
    try {
      updateSelected(await leaveMakeupService.notifyParent(selectedRecord.id, '请假补课处理进度已更新'));
      toast.success('已模拟通知家长');
    } catch (error) {
      toast.error(`通知失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">请假补课</h1>
        <button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
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
            <select value={filters.requestType} onChange={e => setFilters({ ...filters, requestType: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部类型</option>
              <option value="student_leave">学生请假</option>
              <option value="teacher_leave">老师请假</option>
              <option value="reschedule">调课</option>
              <option value="cancellation">课程取消</option>
              <option value="makeup">补课</option>
            </select>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部状态</option>
              <option value="pending">待审批</option>
              <option value="approved">已同意</option>
              <option value="makeup_pending">待安排补课</option>
              <option value="makeup_scheduled">补课已排</option>
              <option value="parent_notified">已通知家长</option>
            </select>
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
              {visibleRecords.map((record) => (
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
                    {record.originalDate} {record.originalTime || ''}
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
                    <span className="font-medium text-gray-900">{selectedRecord.courseName || selectedRecord.className}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-1">原上课时间</span>
                    <span className="font-medium text-gray-900">{selectedRecord.originalDate} {selectedRecord.originalTime || ''}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-1">补课时间</span>
                    <span className="font-medium text-gray-900">{selectedRecord.newDate ? `${selectedRecord.newDate} ${selectedRecord.newStartTime || ''}` : '-'}</span>
                  </div>
                  <div>
                    <span className="block text-gray-500 mb-1">通知状态</span>
                    <span className="font-medium text-gray-900">{selectedRecord.parentNotified || selectedRecord.notifyStatus === 'notified' ? '已通知家长' : '未通知'}</span>
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
                  <button onClick={handleApprove} className="flex-1 py-2 bg-green-50 text-green-700 font-medium rounded-lg border border-green-200 hover:bg-green-100 flex justify-center items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> 批准申请
                  </button>
                  <button onClick={handleReject} className="flex-1 py-2 bg-red-50 text-red-700 font-medium rounded-lg border border-red-200 hover:bg-red-100 flex justify-center items-center gap-2">
                    <XCircle className="w-4 h-4" /> 拒绝申请
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">课时处理</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="credit" className="text-blue-600 focus:ring-blue-500" checked={!selectedRecord.deductCredit} readOnly />
                        不扣课时，安排补课
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" name="credit" className="text-blue-600 focus:ring-blue-500" checked={selectedRecord.deductCredit} readOnly />
                        直接扣除课时
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">补课安排 (如需)</label>
                    <div className="flex gap-2">
                      <input type="text" value={selectedRecord.newDate ? `${selectedRecord.newDate} ${selectedRecord.newStartTime || ''}-${selectedRecord.newEndTime || ''}` : ''} readOnly className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2" />
                      <button onClick={handleScheduleMakeup} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100">
                        安排补课
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" checked={selectedRecord.parentNotified || selectedRecord.notifyStatus === 'notified'} readOnly />
                      <Bell className="w-4 h-4 text-gray-400" /> 处理完成后自动通知家长和老师
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              <button onClick={() => setSelectedRecord(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button onClick={handleNotifyParent} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                通知家长
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
