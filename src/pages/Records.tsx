import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, MessageSquare, ChevronRight, X, Sparkles, Save, Send } from 'lucide-react';
import type { CreditAccount, LessonRecord, LessonRecordStatus } from '../types';
import { useAppContext } from '../context/AppContext';
import { Drawer } from '../components/ui/Drawer';
import { lessonService } from '../services/lessonService';
import { creditService } from '../services/creditService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

const recordsPageStats = lessonService.getRecordsPageStatsSync();

export function Records() {
  const { courses, teachers } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [records, setRecords] = useState<LessonRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<LessonRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [deductionHours, setDeductionHours] = useState(0);
  const [deductionNote, setDeductionNote] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    teacherId: '',
    courseId: '',
    status: '' as LessonRecordStatus | '',
  });
  const [feedbackForm, setFeedbackForm] = useState({
    topic: '',
    performance: '',
    knowledgeMastery: '',
    homework: '',
    nextPlan: '',
    needAdvisorFollowUp: false,
    syncToParent: true,
    internalNotes: '',
  });
  
  // AI summary state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const filteredRecords = useMemo(() => records, [records]);

  const refreshRecords = async () => {
    setIsLoading(true);
    try {
      const latest = await lessonService.listRecords({
        ...filters,
        search: searchTerm,
      });
      setRecords(latest);
    } catch (error) {
      toast.error(`上课记录加载失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshRecords();
  }, [filters.startDate, filters.endDate, filters.teacherId, filters.courseId, filters.status]);

  useEffect(() => {
    const timer = window.setTimeout(refreshRecords, 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'draft': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">草稿</span>;
      case 'pending_feedback': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">待提交反馈</span>;
      case 'submitted': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">已提交</span>;
      case 'completed': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">已完成</span>;
      case 'scheduled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">未开始</span>;
      case 'cancelled': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">已取消</span>;
      case 'need_makeup': return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">待补课</span>;
      default: return null;
    }
  };

  const getAttendanceBadge = (attendance: string) => {
    switch(attendance) {
      case 'present': return <span className="text-green-600">正常出勤</span>;
      case 'absent': return <span className="text-red-600">缺勤</span>;
      case 'student_leave': return <span className="text-orange-600">学生请假</span>;
      case 'teacher_leave': return <span className="text-purple-600">老师请假</span>;
      default: return null;
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedRecord) return;
    setIsGeneratingAI(true);
    try {
      const summary = await lessonService.generateFeedback({ ...selectedRecord, ...feedbackForm });
      setAiSummary(summary);
      const updated = await lessonService.updateRecord(selectedRecord.id, { aiSummary: summary });
      setSelectedRecord(updated);
      setRecords(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success('AI 反馈已生成');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const loadCreditAccount = async (record: LessonRecord) => {
    setCreditAccount(null);
    setDeductionHours(record.duration ?? record.creditsConsumed ?? 0);
    if (!record.studentId || !record.courseId) return;
    try {
      const accounts = await creditService.listAccounts({ studentId: record.studentId, courseId: record.courseId });
      setCreditAccount(accounts[0] ?? null);
    } catch {
      setCreditAccount(null);
    }
  };

  const buildFeedbackPayload = () => ({
    ...feedbackForm,
    aiSummary: aiSummary || selectedRecord?.aiSummary,
  });

  const handleSaveDraft = async () => {
    if (!selectedRecord) return;
    setIsSaving(true);
    try {
      const updated = await lessonService.saveDraft(selectedRecord.id, buildFeedbackPayload());
      setSelectedRecord(updated);
      setRecords(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success('草稿已保存');
    } catch (error) {
      toast.error(`保存草稿失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!selectedRecord) return;
    if (!feedbackForm.topic.trim() || !feedbackForm.performance.trim() || !feedbackForm.homework.trim()) {
      toast.error('请填写本节课内容、学生课堂表现和作业布置');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await lessonService.submitFeedback(selectedRecord.id, buildFeedbackPayload());
      setSelectedRecord(updated);
      setRecords(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success('反馈已提交');
    } catch (error) {
      toast.error(`提交反馈失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeduction = async () => {
    if (!selectedRecord) return;
    const balance = creditAccount?.remainingHours ?? 0;
    if (!window.confirm(`确认扣减 ${deductionHours} 课时？扣减后余额为 ${balance - deductionHours} 课时。`)) return;
    setIsSaving(true);
    try {
      const result = await lessonService.confirmDeduction(selectedRecord.id, {
        consumedHours: deductionHours,
        deductionNote,
        syncToParent: feedbackForm.syncToParent,
      });
      setSelectedRecord(result.lessonRecord);
      setCreditAccount(result.creditAccount as CreditAccount);
      setRecords(prev => prev.map(item => item.id === result.lessonRecord.id ? result.lessonRecord : item));
      toast.success('消课成功，课时流水已生成');
    } catch (error) {
      toast.error(`确认消课失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">上课记录与消课</h1>
        <div className="flex gap-3">
          <button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            导出记录
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">今日待记录课程</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">{recordsPageStats.todayPending}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">待提交反馈</p>
              <h3 className="text-2xl font-bold text-purple-600 mt-1">{recordsPageStats.feedbackPending}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">待消课课程</p>
              <h3 className="text-2xl font-bold text-orange-600 mt-1">{recordsPageStats.deductPending}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">异常课程</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{recordsPageStats.abnormal}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-600" />
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
              placeholder="搜索学生姓名、课程名..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg" />
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg" />
            <select value={filters.teacherId} onChange={e => setFilters({ ...filters, teacherId: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部老师</option>
              {teachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </select>
            <select value={filters.courseId} onChange={e => setFilters({ ...filters, courseId: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部课程</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value as LessonRecordStatus | '' })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部状态</option>
              <option value="draft">草稿</option>
              <option value="pending_feedback">待提交反馈</option>
              <option value="submitted">已提交</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-6 py-4">上课日期</th>
                <th scope="col" className="px-6 py-4">时间</th>
                <th scope="col" className="px-6 py-4">学员/班级</th>
                <th scope="col" className="px-6 py-4">课程</th>
                <th scope="col" className="px-6 py-4">授课老师</th>
                <th scope="col" className="px-6 py-4">状态</th>
                <th scope="col" className="px-6 py-4">反馈状态</th>
                <th scope="col" className="px-6 py-4">本节课时</th>
                <th scope="col" className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr 
                  key={record.id} 
                  className="bg-white border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelectedRecord(record);
                    setAiSummary(record.aiSummary || '');
                    setFeedbackForm({
                      topic: record.topic || '',
                      performance: record.performance || '',
                      knowledgeMastery: record.knowledgeMastery || '',
                      homework: record.homework || '',
                      nextPlan: record.nextPlan || '',
                      needAdvisorFollowUp: Boolean(record.needAdvisorFollowUp),
                      syncToParent: record.syncToParent ?? true,
                      internalNotes: record.internalNotes || '',
                    });
                    loadCreditAccount(record);
                  }}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {record.date}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {record.timeString || `${record.startTime ?? ''} - ${record.endTime ?? ''}`}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{record.studentName || record.className || '-'}</div>
                    <div className="text-xs text-gray-500">{record.studentName ? record.className : '班级记录'}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {record.courseName || '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-700">
                    {record.teacherName}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {getStatusBadge(record.status)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {record.feedbackStatus === 'submitted' ? (
                      <span className="flex items-center text-green-600 text-xs font-medium"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />已提交</span>
                    ) : (
                      <span className="flex items-center text-orange-500 text-xs font-medium"><AlertCircle className="w-3.5 h-3.5 mr-1" />待提交</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {record.duration ?? record.creditsConsumed}h
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center justify-end w-full">
                      记录详情 <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title="上课记录详情">
        {selectedRecord && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Info */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                    {(selectedRecord.studentName || selectedRecord.className || '课').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{selectedRecord.studentName || selectedRecord.className || '上课记录'}</h3>
                    <p className="text-sm text-gray-500">{selectedRecord.courseName || selectedRecord.className}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{selectedRecord.date}</div>
                  <div className="text-xs text-gray-500 mt-1">{selectedRecord.timeString || `${selectedRecord.startTime ?? ''} - ${selectedRecord.endTime ?? ''}`}</div>
                  <div className="text-xs text-gray-500 mt-1">授课老师: {selectedRecord.teacherName}</div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">上课状态</p>
                  {getStatusBadge(selectedRecord.status)}
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">教室 / 课时</p>
                  <div className="text-sm font-medium text-gray-900">{selectedRecord.classroom || '-'} · {selectedRecord.duration ?? 0}h</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">学员 / 班级</p>
                  <div className="text-sm font-medium text-gray-900">{selectedRecord.studentName || selectedRecord.className || '-'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 mb-2">反馈状态</p>
                  <div className="text-sm font-medium text-gray-900">{selectedRecord.feedbackStatus === 'submitted' ? '已提交' : '待提交'}</div>
                </div>
              </div>

              {/* Feedback Form */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-400" />
                  课堂反馈记录
                </h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">本节课内容</label>
                  <input type="text" value={feedbackForm.topic} onChange={e => setFeedbackForm({ ...feedbackForm, topic: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">学生课堂表现</label>
                  <textarea rows={3} value={feedbackForm.performance} onChange={e => setFeedbackForm({ ...feedbackForm, performance: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="记录学生的课堂互动、专注度及表现..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">知识点掌握情况</label>
                  <textarea rows={2} value={feedbackForm.knowledgeMastery} onChange={e => setFeedbackForm({ ...feedbackForm, knowledgeMastery: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="记录学生对重点、难点的掌握情况..."></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">作业布置</label>
                  <textarea rows={2} value={feedbackForm.homework} onChange={e => setFeedbackForm({ ...feedbackForm, homework: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="布置的作业..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">下节课计划</label>
                  <textarea rows={2} value={feedbackForm.nextPlan} onChange={e => setFeedbackForm({ ...feedbackForm, nextPlan: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="下次课预告..."></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">内部备注</label>
                  <textarea rows={2} value={feedbackForm.internalNotes} onChange={e => setFeedbackForm({ ...feedbackForm, internalNotes: e.target.value })} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="仅内部可见..."></textarea>
                </div>

                <div className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={feedbackForm.needAdvisorFollowUp} onChange={e => setFeedbackForm({ ...feedbackForm, needAdvisorFollowUp: e.target.checked })} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                    需要顾问跟进
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={feedbackForm.syncToParent} onChange={e => setFeedbackForm({ ...feedbackForm, syncToParent: e.target.checked })} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                    同步给家长
                  </label>
                </div>
              </div>

              {/* AI Summary Card */}
              <div className="bg-purple-50 p-5 rounded-xl border border-purple-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-24 h-24 text-purple-600" />
                </div>
                <div className="relative z-10">
                  <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    AI 课后反馈总结
                  </h4>
                  {aiSummary ? (
                    <div className="bg-white/80 p-4 rounded-lg border border-purple-200 shadow-sm">
                      <p className="text-sm text-purple-900 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                      <div className="mt-3 flex justify-end gap-2">
                        <button onClick={() => setAiSummary('')} className="text-xs text-purple-600 hover:text-purple-800 font-medium">重新生成</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-purple-800 leading-relaxed bg-white/60 p-4 rounded-lg border border-purple-100">
                        点击下方按钮，AI 将根据您的课堂表现记录自动生成结构化、专业亲切的家长反馈话术摘要，支持直接发送给家长微信。
                      </p>
                      <button 
                        onClick={handleGenerateAI}
                        disabled={isGeneratingAI}
                        className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm px-4 py-2 flex items-center gap-2 transition-colors disabled:opacity-70"
                      >
                        <Sparkles className={`w-4 h-4 ${isGeneratingAI ? 'animate-spin' : ''}`} />
                        {isGeneratingAI ? '正在生成...' : '一键生成家长反馈'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  确认消课
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">当前课程</label>
                    <div className="text-sm font-medium text-gray-900">{selectedRecord.courseName || '-'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">消课状态</label>
                    <div className="text-sm font-medium text-gray-900">{selectedRecord.deductionStatus === 'deducted' ? '已消课' : '待消课'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">本节课时</label>
                    <div className="text-sm font-medium text-gray-900">{selectedRecord.duration ?? 0}h</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">当前剩余课时</label>
                    <div className={`text-sm font-medium ${creditAccount?.lowBalance ? 'text-red-600' : 'text-gray-900'}`}>{creditAccount ? `${creditAccount.remainingHours}h` : '-'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">本次扣减课时</label>
                    <input type="number" min="0" step="0.5" value={deductionHours} onChange={e => setDeductionHours(Number(e.target.value))} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">扣减后剩余课时</label>
                    <div className="text-sm font-medium text-gray-900">{creditAccount ? `${creditAccount.remainingHours - deductionHours}h` : '-'}</div>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">扣减备注</label>
                    <input value={deductionNote} onChange={e => setDeductionNote(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="可选" />
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={feedbackForm.syncToParent} onChange={e => setFeedbackForm({...feedbackForm, syncToParent: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    是否同步给家长
                  </label>
                </div>
                {!creditAccount && (
                  <p className="text-xs text-orange-600">未找到该学生课程的课时账户，暂不能确认消课。</p>
                )}
                <button
                  onClick={handleConfirmDeduction}
                  disabled={isSaving || selectedRecord.deductionStatus === 'deducted' || !['submitted', 'completed'].includes(selectedRecord.status) || !creditAccount || deductionHours <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 transition-colors disabled:opacity-50"
                >
                  {selectedRecord.deductionStatus === 'deducted' ? '已消课' : '确认消课'}
                </button>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-3 shrink-0">
              {can(user?.role, 'submitLessonRecord') && (
                <button onClick={handleSaveDraft} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  保存草稿
                </button>
              )}
              {can(user?.role, 'submitLessonRecord') && (
                <button onClick={handleSubmitFeedback} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  提交反馈
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
