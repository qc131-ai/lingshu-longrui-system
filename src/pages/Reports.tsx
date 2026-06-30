import { useEffect, useMemo, useState } from 'react';
import { Download, Send, Sparkles, TrendingUp, BookOpen, Clock, Target, Search, X, FileText, type LucideIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import toast from 'react-hot-toast';
import { reportService, type GenerateReportInput } from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';
import { useAppContext } from '../context/AppContext';
import type { ParentReport } from '../types';

const reportTypeLabels: Record<string, string> = {
  weekly: '周报',
  monthly: '月报',
  stage: '阶段报告',
  custom: '自定义报告',
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  generated: '已生成',
  reviewed: '已审核',
  sent: '已发送',
  archived: '已归档',
};

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function Reports() {
  const { user } = useAuth();
  const { students, courses } = useAppContext();
  const [reports, setReports] = useState<ParentReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ParentReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [filters, setFilters] = useState({ studentId: '', courseId: '', reportType: '', status: '', startDate: '', endDate: '' });
  const [form, setForm] = useState<GenerateReportInput>({
    studentId: students[0]?.id ?? '',
    courseId: '',
    reportType: 'monthly',
    reportPeriodStart: today(-30),
    reportPeriodEnd: today(),
    includeLessons: true,
    includeCredits: true,
    includeLeaveMakeup: true,
    includeHomework: true,
    includeAiSummary: true,
  });

  const stats = useMemo(() => ({
    monthly: reports.filter(report => report.reportType === 'monthly').length,
    reviewing: reports.filter(report => report.status === 'generated' || report.status === 'draft').length,
    sent: reports.filter(report => report.status === 'sent').length,
    lowBalance: reports.filter(report => report.creditSummary?.includes('低课时')).length,
  }), [reports]);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const latest = await reportService.listReports(filters);
      setReports(latest);
      setSelectedReport(prev => prev ? latest.find(report => report.id === prev.id) ?? prev : latest[0] ?? null);
    } catch (error) {
      toast.error(`家长报告加载失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filters.studentId, filters.courseId, filters.reportType, filters.status, filters.startDate, filters.endDate]);

  useEffect(() => {
    if (!form.studentId && students[0]?.id) setForm(prev => ({ ...prev, studentId: students[0].id }));
  }, [students, form.studentId]);

  const handleGenerate = async () => {
    if (!form.studentId) {
      toast.error('请选择学员');
      return;
    }
    setIsGenerating(true);
    try {
      const report = await reportService.generateReport({ ...form, courseId: form.courseId || undefined });
      setReports(prev => [report, ...prev.filter(item => item.id !== report.id)]);
      setSelectedReport(report);
      setShowGenerate(false);
      toast.success('家长报告已生成');
    } catch (error) {
      toast.error(`生成报告失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedReport?.id) return;
    const title = window.prompt('报告标题', selectedReport.title || '学习报告');
    if (!title) return;
    const summary = window.prompt('阶段总结', selectedReport.summary || '') ?? selectedReport.summary;
    const nextStepPlan = window.prompt('下阶段计划', selectedReport.nextStepPlan || '') ?? selectedReport.nextStepPlan;
    try {
      const updated = await reportService.updateReport(selectedReport.id, { title, summary, nextStepPlan });
      setSelectedReport(updated);
      setReports(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success('报告已保存');
    } catch (error) {
      toast.error(`编辑报告失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleSendToParent = async () => {
    if (!selectedReport?.id) return;
    if (!confirm('确认将该报告发送给家长吗？')) return;
    try {
      const updated = await reportService.sendReport(selectedReport.id);
      setSelectedReport(updated);
      setReports(prev => prev.map(item => item.id === updated.id ? updated : item));
      toast.success('家长报告已发送');
    } catch (error) {
      toast.error(`发送失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleExportPDF = () => {
    toast.success('PDF 导出功能已触发');
  };

  const report = selectedReport;
  const trendData = report?.trendData ?? reportService.getTrendDataSync();
  const radarData = report?.radarData ?? reportService.getRadarDataSync();
  const statCards: Array<[string, number, LucideIcon, string, string]> = [
    ['本月报告', stats.monthly, Clock, 'text-blue-600', 'bg-blue-50'],
    ['待审核报告', stats.reviewing, FileText, 'text-orange-600', 'bg-orange-50'],
    ['已发送报告', stats.sent, Send, 'text-green-600', 'bg-green-50'],
    ['低课时提醒报告', stats.lowBalance, Target, 'text-red-600', 'bg-red-50'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">家长报告</h1>
        <div className="flex gap-3">
          {can(user?.role, 'generateReport') && (
            <button onClick={() => setShowGenerate(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              生成报告
            </button>
          )}
          <button onClick={handleExportPDF} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            <Download className="w-4 h-4" />
            导出 PDF
          </button>
          {can(user?.role, 'sendReport') && report?.id && (
            <button onClick={handleSendToParent} disabled={report.status === 'sent'} className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2 disabled:opacity-50">
              <Send className="w-4 h-4" />
              {report.status === 'sent' ? '已发送' : '发送给家长'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map(([label, value, Icon, color, bg]) => (
          <div key={label} className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <h3 className={`text-2xl font-bold mt-1 ${color}`}>{value}</h3>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col xl:flex-row justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select value={filters.studentId} onChange={e => setFilters({ ...filters, studentId: e.target.value })} className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none">
              <option value="">全部学员</option>
              {students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filters.courseId} onChange={e => setFilters({ ...filters, courseId: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部课程</option>
              {courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <select value={filters.reportType} onChange={e => setFilters({ ...filters, reportType: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部类型</option>
              {Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg">
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">报告标题</th>
                <th className="px-6 py-4">学员 / 课程</th>
                <th className="px-6 py-4">类型</th>
                <th className="px-6 py-4">周期</th>
                <th className="px-6 py-4">顾问</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">发送时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(item => (
                <tr key={item.id} onClick={() => setSelectedReport(item)} className={`bg-white border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${selectedReport?.id === item.id ? 'bg-blue-50/60' : ''}`}>
                  <td className="px-6 py-4 font-medium text-gray-900">{item.title || '学习报告'}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.studentName}</div>
                    <div className="text-xs text-gray-500">{item.courseName || item.courses || '-'}</div>
                  </td>
                  <td className="px-6 py-4">{reportTypeLabels[item.reportType || 'monthly']}</td>
                  <td className="px-6 py-4">{item.period}</td>
                  <td className="px-6 py-4">{item.advisor || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700">{statusLabels[item.status || 'generated']}</span>
                  </td>
                  <td className="px-6 py-4">{item.sentAt ? new Date(item.sentAt).toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">查看报告</button>
                  </td>
                </tr>
              ))}
              {!isLoading && reports.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-400">暂无家长报告</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {report && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 text-white">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight mb-2">{report.title || '学习阶段报告'}</h2>
                <p className="text-blue-200">{report.period}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-serif tracking-widest">ASTRALINK</div>
                <p className="text-xs text-blue-300 mt-1">朗睿教育</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-2 border-white/30 backdrop-blur-sm">
                {report.studentName.slice(0, 1)}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-2">
                <div><p className="text-blue-300 text-sm">学生姓名</p><p className="font-medium text-lg">{report.studentName}</p></div>
                <div><p className="text-blue-300 text-sm">当前年级</p><p className="font-medium text-lg">{report.grade}</p></div>
                <div><p className="text-blue-300 text-sm">主修课程</p><p className="font-medium text-lg">{report.courseName || report.courses}</p></div>
                <div><p className="text-blue-300 text-sm">负责顾问</p><p className="font-medium text-lg">{report.advisor || '-'}</p></div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-10">
            <div className="flex justify-end gap-3">
              {can(user?.role, 'editReport') && report.status !== 'sent' && (
                <button onClick={handleEdit} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  编辑报告
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="flex items-center gap-2 text-gray-500 mb-2"><Clock className="w-4 h-4" /><span className="text-sm font-medium">周期课时</span></div><div className="text-2xl font-bold text-gray-900">{report.monthlyHours}<span className="text-base font-normal text-gray-500 ml-1">h</span></div></div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="flex items-center gap-2 text-gray-500 mb-2"><Target className="w-4 h-4" /><span className="text-sm font-medium">出勤率</span></div><div className="text-2xl font-bold text-gray-900">{report.attendanceRate}<span className="text-base font-normal text-gray-500 ml-1">%</span></div></div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="flex items-center gap-2 text-gray-500 mb-2"><BookOpen className="w-4 h-4" /><span className="text-sm font-medium">作业完成率</span></div><div className="text-2xl font-bold text-gray-900">{report.homeworkRate}<span className="text-base font-normal text-gray-500 ml-1">%</span></div></div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100"><div className="flex items-center gap-2 text-gray-500 mb-2"><TrendingUp className="w-4 h-4" /><span className="text-sm font-medium">阶段评分</span></div><div className="text-2xl font-bold text-green-600">{report.scoreImprovement}<span className="text-base font-normal text-green-600 ml-1">pts</span></div></div>
            </div>

            <section className="bg-purple-50 p-6 rounded-2xl border border-purple-100">
              <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-3 text-lg"><Sparkles className="w-5 h-5 text-purple-600" />阶段总结</h3>
              <p className="text-purple-900 leading-relaxed text-sm whitespace-pre-wrap">{report.summary || report.aiSummary || '暂无阶段总结'}</p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">能力雷达图</h3>
                <div className="h-64 bg-gray-50 rounded-xl border border-gray-100">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                      <PolarGrid stroke="#E5E7EB" />
                      <PolarAngleAxis dataKey="subject" tick={{fill: '#6B7280', fontSize: 12}} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name="Student" dataKey="A" stroke="#0066ff" fill="#0066ff" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">学习趋势</h3>
                <div className="h-64 bg-gray-50 rounded-xl border border-gray-100 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="colorScore2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient></defs>
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 12}} domain={['auto', 'auto']} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorScore2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                ['老师反馈摘要', report.teacherFeedbackSummary],
                ['课时情况', report.creditSummary],
                ['请假补课情况', report.leaveMakeupSummary],
                ['薄弱点分析', report.weaknessAnalysis],
                ['下阶段计划', report.nextStepPlan],
                ['家长可见内容', report.parentVisibleContent],
              ].map(([title, content]) => (
                <section key={title} className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <h3 className="text-base font-bold text-gray-900 mb-3">{title}</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{content || '-'}</p>
                </section>
              ))}
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">近期课程记录摘选</h3>
              <div className="space-y-4">
                {report.courseRecords.map((record, i) => (
                  <div key={`${record.date}-${i}`} className="flex gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="w-20 shrink-0 text-center"><div className="text-xs text-gray-500">日期</div><div className="font-bold text-blue-600">{record.date}</div></div>
                    <div className="w-px bg-gray-200 shrink-0"></div>
                    <div><div className="flex items-center gap-2 mb-1"><span className="font-bold text-gray-900">{record.course}</span><span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">{record.teacher}</span></div><p className="text-sm text-gray-700 font-medium mb-1">课题: {record.topic || '-'}</p><p className="text-sm text-gray-600">{record.feedback || '-'}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 text-center border-t border-gray-200 text-gray-400 text-sm">
            Astralink 灵枢 · 教务课程管理系统自动生成
          </div>
        </div>
      )}

      {showGenerate && (
        <div className="fixed inset-0 z-50 bg-gray-900/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="font-bold text-gray-900">生成家长报告</h2>
              <button onClick={() => setShowGenerate(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <label className="text-sm text-gray-700 col-span-2">学员<select value={form.studentId} onChange={e => setForm({ ...form, studentId: e.target.value })} className="mt-1 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg"><option value="">请选择</option>{students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
              <label className="text-sm text-gray-700 col-span-2">课程<select value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} className="mt-1 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg"><option value="">全部课程</option>{courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label>
              <label className="text-sm text-gray-700">报告类型<select value={form.reportType} onChange={e => setForm({ ...form, reportType: e.target.value as GenerateReportInput['reportType'] })} className="mt-1 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg">{Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm text-gray-700">周期开始<input type="date" value={form.reportPeriodStart} onChange={e => setForm({ ...form, reportPeriodStart: e.target.value })} className="mt-1 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg" /></label>
              <label className="text-sm text-gray-700">周期结束<input type="date" value={form.reportPeriodEnd} onChange={e => setForm({ ...form, reportPeriodEnd: e.target.value })} className="mt-1 w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg" /></label>
              <div className="col-span-2 grid grid-cols-2 gap-3">
                {[
                  ['includeLessons', '包含上课记录'],
                  ['includeCredits', '包含课时数据'],
                  ['includeLeaveMakeup', '包含请假补课'],
                  ['includeHomework', '包含作业'],
                  ['includeAiSummary', '包含 AI 总结'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={Boolean(form[key as keyof GenerateReportInput])} onChange={e => setForm({ ...form, [key]: e.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />{label}</label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowGenerate(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
              <button onClick={handleGenerate} disabled={isGenerating} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">{isGenerating ? '生成中...' : '确认生成'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
