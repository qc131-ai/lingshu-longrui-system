import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, CheckCircle2, Clipboard, FileText, RefreshCw, Search, XCircle } from 'lucide-react';
import { aiService } from '../services/aiService';
import type { AITask, AITaskStatus, AITaskType } from '../types';

const taskTypeLabels: Record<AITaskType, string> = {
  lesson_feedback: '老师反馈',
  parent_report_summary: '报告草稿',
  renewal_suggestion: '续费建议',
  learning_summary: '学习总结',
  chat: '沟通/跟进',
};

const statusLabels: Record<AITaskStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '不采用',
};

function statusClass(status: AITaskStatus) {
  if (status === 'completed') return 'bg-green-100 text-green-700';
  if (status === 'failed') return 'bg-red-100 text-red-700';
  if (status === 'processing') return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
}

function safeDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function AITasks() {
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [selectedTask, setSelectedTask] = useState<AITask | null>(null);
  const [statusFilter, setStatusFilter] = useState<AITaskStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<AITaskType | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const result = await aiService.listTasks({ status: statusFilter, taskType: typeFilter });
      setTasks(result.tasks);
      setSelectedTask(current => current ? result.tasks.find(task => task.id === current.id) ?? result.tasks[0] ?? null : result.tasks[0] ?? null);
    } catch (error) {
      toast.error(`AI 任务加载失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, [statusFilter, typeFilter]);

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return tasks;
    return tasks.filter(task => [
      task.title,
      task.content,
      task.note,
      task.studentName,
      task.userName,
      taskTypeLabels[task.taskType],
      statusLabels[task.status],
    ].some(value => String(value ?? '').toLowerCase().includes(keyword)));
  }, [search, tasks]);

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(task => task.status === 'completed').length,
    pending: tasks.filter(task => task.status === 'pending').length,
    failed: tasks.filter(task => task.status === 'failed').length,
  }), [tasks]);

  const copyContent = async (task: AITask) => {
    try {
      await navigator.clipboard.writeText(task.content || task.note || task.title);
      toast.success('已复制草稿内容');
    } catch {
      toast.error('复制失败，请手动选择内容');
    }
  };

  const updateStatus = async (task: AITask, status: Extract<AITaskStatus, 'pending' | 'completed' | 'failed'>) => {
    try {
      const result = await aiService.updateTaskStatus(task.id, status);
      setTasks(prev => prev.map(item => item.id === task.id ? result.task : item));
      setSelectedTask(result.task);
      toast.success(result.message ?? 'AI 任务状态已更新');
    } catch (error) {
      toast.error(`状态更新失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 任务中心</h1>
        <p className="mt-1 text-sm text-gray-500">查看 AI 生成的沟通草稿、续费建议、报告润色和跟进记录</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['全部任务', stats.total, 'text-blue-600'],
          ['待处理', stats.pending, 'text-amber-600'],
          ['已完成', stats.completed, 'text-green-600'],
          ['不采用', stats.failed, 'text-red-600'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">{label}</div>
            <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索学员、草稿内容、创建人..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AITaskStatus | '')} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="completed">已完成</option>
            <option value="failed">不采用</option>
          </select>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AITaskType | '')} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">全部类型</option>
            {Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={loadTasks} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredTasks.map(task => (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`w-full text-left p-4 hover:bg-gray-50 ${selectedTask?.id === task.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Bot className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-gray-900 truncate">{task.title}</span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 line-clamp-2">{task.content || task.note || '暂无内容'}</div>
                    <div className="mt-2 text-xs text-gray-400">{task.studentName ?? '-'} · {task.userName ?? '-'} · {safeDate(task.createdAt)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">{taskTypeLabels[task.taskType]}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusClass(task.status)}`}>{statusLabels[task.status]}</span>
                  </div>
                </div>
              </button>
            ))}
            {!isLoading && filteredTasks.length === 0 && (
              <div className="p-10 text-center text-gray-500">暂无 AI 任务</div>
            )}
            {isLoading && <div className="p-10 text-center text-gray-500">加载中...</div>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 h-fit">
          {selectedTask ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-gray-900">{selectedTask.title}</h2>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusClass(selectedTask.status)}`}>{statusLabels[selectedTask.status]}</span>
                </div>
                <div className="mt-1 text-sm text-gray-500">{taskTypeLabels[selectedTask.taskType]} · {safeDate(selectedTask.createdAt)}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">关联学员</div>
                  <div className="font-medium text-gray-900">{selectedTask.studentName ?? '-'}</div>
                </div>
                <div>
                  <div className="text-gray-500">创建人</div>
                  <div className="font-medium text-gray-900">{selectedTask.userName ?? '-'}</div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">草稿内容</div>
                <div className="whitespace-pre-wrap text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-lg p-3 min-h-32">
                  {selectedTask.content || selectedTask.note || '暂无内容'}
                </div>
              </div>

              {selectedTask.note && selectedTask.content && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  {selectedTask.note}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => copyContent(selectedTask)} className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 flex items-center gap-2">
                  <Clipboard className="w-4 h-4" />
                  复制内容
                </button>
                <button onClick={() => updateStatus(selectedTask, 'completed')} className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  标记完成
                </button>
                <button onClick={() => updateStatus(selectedTask, 'failed')} className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  不采用
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-16">
              <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              选择左侧任务查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
