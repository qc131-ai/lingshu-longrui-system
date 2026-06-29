import { useState } from 'react';
import { Download, Share2, Send, Sparkles, TrendingUp, BookOpen, Clock, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import toast from 'react-hot-toast';
import { reportService } from '../services/reportService';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

const report = reportService.getParentReportSync();
const reportTrendData = reportService.getTrendDataSync();
const reportRadarData = reportService.getRadarDataSync();

export function Reports() {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const summary = await reportService.generateParentReportSummary();
      setAiSummary(summary);
      toast.success('AI 摘要生成成功');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    toast.success('PDF 导出功能已触发');
  };

  const handleSendToParent = () => {
    if (confirm('确认将该报告发送给家长吗？')) {
      toast.success('家长报告已发送');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">家长报告</h1>
        <div className="flex gap-3">
          {can(user?.role, 'sendReport') && (
            <button 
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="bg-white border border-gray-300 text-purple-700 hover:bg-purple-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
              {isGenerating ? '生成中...' : '生成 AI 摘要'}
            </button>
          )}
          <button 
            onClick={handleExportPDF}
            className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            导出 PDF
          </button>
          {can(user?.role, 'sendReport') && (
            <button 
              onClick={handleSendToParent}
              className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              发送给家长
            </button>
          )}
        </div>
      </div>

      {/* Report Canvas (PDF Style) */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        {/* Report Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-8 text-white">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">学习阶段报告</h2>
              <p className="text-blue-200">{report.period}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-serif tracking-widest">ASTRALINK</div>
              <p className="text-xs text-blue-300 mt-1">朗睿教育</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold border-2 border-white/30 backdrop-blur-sm">
              张
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-2">
              <div>
                <p className="text-blue-300 text-sm">学生姓名</p>
                <p className="font-medium text-lg">{report.studentName}</p>
              </div>
              <div>
                <p className="text-blue-300 text-sm">当前年级</p>
                <p className="font-medium text-lg">{report.grade}</p>
              </div>
              <div>
                <p className="text-blue-300 text-sm">主修课程</p>
                <p className="font-medium text-lg">{report.courses}</p>
              </div>
              <div>
                <p className="text-blue-300 text-sm">负责顾问</p>
                <p className="font-medium text-lg">{report.advisor}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Report Body */}
        <div className="p-8 space-y-10">
          
          {/* Core Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">本月课时</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.monthlyHours}<span className="text-base font-normal text-gray-500 ml-1">h</span></div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <Target className="w-4 h-4" />
                <span className="text-sm font-medium">出勤率</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.attendanceRate}<span className="text-base font-normal text-gray-500 ml-1">%</span></div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm font-medium">作业完成率</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{report.homeworkRate}<span className="text-base font-normal text-gray-500 ml-1">%</span></div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">测评提分</span>
              </div>
              <div className="text-2xl font-bold text-green-600">+{report.scoreImprovement}<span className="text-base font-normal text-gray-500 ml-1 text-green-600">pts</span></div>
            </div>
          </div>

          {/* AI Summary */}
          {aiSummary ? (
            <div className="bg-purple-50 p-6 rounded-2xl border border-purple-100 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <Sparkles className="w-32 h-32 text-purple-600" />
              </div>
              <div className="relative z-10">
                <h3 className="font-bold text-purple-900 flex items-center gap-2 mb-3 text-lg">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  班主任综合寄语 (AI 生成)
                </h3>
                <p className="text-purple-900 leading-relaxed text-sm whitespace-pre-wrap">
                  {aiSummary}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300 text-center text-gray-500">
              点击上方“生成 AI 摘要”获取基于学生本月表现的综合寄语
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">能力雷达图 (托福)</h3>
              <div className="h-64 bg-gray-50 rounded-xl border border-gray-100">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={reportRadarData}>
                    <PolarGrid stroke="#E5E7EB" />
                    <PolarAngleAxis dataKey="subject" tick={{fill: '#6B7280', fontSize: 12}} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Student" dataKey="A" stroke="#0066ff" fill="#0066ff" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">模考成绩趋势</h3>
              <div className="h-64 bg-gray-50 rounded-xl border border-gray-100 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={reportTrendData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorScore2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
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

          {/* Course Details */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">近期课程记录摘选</h3>
            <div className="space-y-4">
              {report.courseRecords.map((record, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                  <div className="w-16 shrink-0 text-center">
                    <div className="text-xs text-gray-500">2024</div>
                    <div className="font-bold text-blue-600">{record.date}</div>
                  </div>
                  <div className="w-px bg-gray-200 shrink-0"></div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{record.course}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">{record.teacher}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium mb-1">课题: {record.topic}</p>
                    <p className="text-sm text-gray-600">{record.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
        
        {/* Footer */}
        <div className="bg-gray-50 p-6 text-center border-t border-gray-200 text-gray-400 text-sm">
          Astralink 灵枢 · 教务课程管理系统自动生成
        </div>
      </div>
    </div>
  );
}
