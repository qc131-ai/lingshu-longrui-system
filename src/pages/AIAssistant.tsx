import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Sparkles, Send, Bot, User, MessageSquare, Clock, BookOpen, Settings, Plus, Calendar as CalendarIcon, FileText, AlertCircle, Users } from 'lucide-react';
import { aiService } from '../services/aiService';
import type { AICard, AICardAction, AIGenerationResult, AIQueryResult, ParentMessageScenario } from '../types';

const aiChatHistory = aiService.getHistorySync();

const quickQuestions = [
  { icon: BookOpen, label: '查询低课时学生', text: '哪些学生课时低于 5 小时？' },
  { icon: MessageSquare, label: '查询未提交反馈老师', text: '哪些老师本周还没提交反馈？' },
  { icon: CalendarIcon, label: '查询今日教务待办', text: '今天教务有哪些待办？' },
  { icon: AlertCircle, label: '查询待处理请假补课', text: '哪些请假补课还没处理？' },
  { icon: FileText, label: '查询待发送家长报告', text: '哪些家长报告还没发送？' },
  { icon: Users, label: '查询高风险学生', text: '哪些学生需要顾问跟进？' },
];

const listRoutes = new Set(['/students', '/records', '/leaves', '/reports', '/orders', '/schedule']);

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeText(value: unknown, fallback = '-') {
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (value == null) return fallback;
  return fallback;
}

function priorityLabel(priority?: AICard['priority']) {
  if (priority === 'high') return '高优先级';
  if (priority === 'medium') return '中优先级';
  if (priority === 'low') return '低优先级';
  return '待处理';
}

function priorityClass(priority?: AICard['priority']) {
  if (priority === 'high') return 'bg-red-100 text-red-700';
  if (priority === 'medium') return 'bg-orange-100 text-orange-700';
  return 'bg-blue-50 text-blue-700';
}

export function AIAssistant() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; content: string | ReactNode }[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const appendAiText = (content: string | ReactNode) => {
    setMessages(prev => [...prev, { role: 'ai', content }]);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制话术');
    } catch {
      toast.error('复制失败，请手动选择文本复制');
    }
  };

  const renderGeneratedResult = (result: AIGenerationResult) => {
    const sections: Array<{ label: string; value: string | string[] }> = [];
    let copySource = '';

    if (result.kind === 'renewal_suggestion') {
      sections.push(
        { label: '学生情况', value: result.studentSummary },
        { label: '课时情况', value: result.creditSummary },
        { label: '续费建议', value: result.renewalSuggestion },
        { label: '家长话术', value: result.parentMessage },
        { label: '顾问沟通重点', value: result.advisorTalkingPoints },
        { label: '下一步动作', value: result.nextActions },
      );
      copySource = result.parentMessage || result.renewalSuggestion;
    } else if (result.kind === 'parent_message') {
      sections.push(
        { label: '生成话术', value: result.message },
        { label: '关键点', value: result.keyPoints },
        { label: '建议渠道', value: result.suggestedSendChannel },
        { label: '注意事项', value: result.cautionNotes },
      );
      copySource = result.message;
    } else if (result.kind === 'polish_report') {
      sections.push(
        { label: '原摘要', value: result.originalSummary || '-' },
        { label: '润色摘要', value: result.polishedSummary },
        { label: '家长可见内容', value: result.polishedParentVisibleContent },
        { label: '下一步计划', value: result.suggestedNextStepPlan },
      );
      copySource = result.polishedParentVisibleContent || result.polishedSummary;
    } else {
      sections.push(
        { label: '风险等级', value: result.riskLevel === 'high' ? '高' : result.riskLevel === 'medium' ? '中' : '低' },
        { label: '风险原因', value: result.riskReasons },
        { label: '建议动作', value: result.recommendedActions },
        { label: '顾问消息', value: result.advisorMessage },
      );
      copySource = result.advisorMessage;
    }

    return (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="font-bold text-gray-900">{result.title}</div>
              <div className="text-xs text-gray-500 mt-1">基于真实教务数据的规则型生成</div>
            </div>
            {'riskLevel' in result && (
              <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${priorityClass(result.riskLevel)}`}>
                {priorityLabel(result.riskLevel)}
              </span>
            )}
          </div>
          <div className="space-y-3 text-sm">
            {sections.map((section) => (
              <div key={section.label}>
                <div className="text-gray-500 mb-1">{section.label}</div>
                {Array.isArray(section.value) ? (
                  <ul className="list-disc pl-5 text-gray-800 space-y-1">
                    {section.value.length > 0 ? section.value.map((item, index) => <li key={`${section.label}-${index}-${item}`}>{item}</li>) : <li>-</li>}
                  </ul>
                ) : (
                  <p className="text-gray-800 whitespace-pre-line leading-relaxed">{section.value || '-'}</p>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={() => copyText(copySource)} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">
              复制话术
            </button>
            <button onClick={() => toast.success('已记录到学生跟进任务')} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50">
              保存到学生档案
            </button>
            {result.kind === 'polish_report' && (
              <button onClick={() => toast.success('已生成报告润色结果，可在报告页应用')} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50">
                应用到家长报告
              </button>
            )}
            <button onClick={() => toast.success('已标记为已跟进')} className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50">
              标记为已跟进
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleGenerateAction = async (action: AICardAction, cardData?: Record<string, unknown>) => {
    const payload = { ...(cardData ?? {}), ...(action.payload ?? {}) };
    const studentId = typeof payload.studentId === 'string' ? payload.studentId : undefined;
    const courseId = typeof payload.courseId === 'string' ? payload.courseId : undefined;
    const reportId = typeof payload.reportId === 'string' ? payload.reportId : undefined;

    setIsTyping(true);
    try {
      if (action.target === 'renewal_suggestion') {
        if (!studentId) throw new Error('缺少 studentId，无法生成续费建议');
        const result = await aiService.generateRenewalSuggestion({ studentId, courseId, tone: 'professional', includeParentMessage: true });
        appendAiText(renderGeneratedResult({ kind: 'renewal_suggestion', title: 'AI 续费建议', ...result }));
        return;
      }
      if (action.target === 'parent_message') {
        if (!studentId) throw new Error('缺少 studentId，无法生成家长沟通话术');
        const scenario = typeof payload.scenario === 'string' ? payload.scenario as ParentMessageScenario : 'renewal_followup';
        const result = await aiService.generateParentMessage({ studentId, courseId, scenario, tone: 'professional' });
        appendAiText(renderGeneratedResult({ kind: 'parent_message', ...result }));
        return;
      }
      if (action.target === 'polish_report') {
        if (!reportId) throw new Error('缺少 reportId，无法润色报告');
        const result = await aiService.polishReport({ reportId, tone: 'warm' });
        appendAiText(renderGeneratedResult({ kind: 'polish_report', title: 'AI 家长报告润色', ...result }));
        return;
      }
      if (action.target === 'student_risk_summary') {
        if (!studentId) throw new Error('缺少 studentId，无法生成风险总结');
        const result = await aiService.generateStudentRiskSummary({ studentId });
        appendAiText(renderGeneratedResult({ kind: 'student_risk_summary', title: 'AI 学生风险总结', ...result }));
        return;
      }
      toast.success(action.message ?? '已生成');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 内容生成失败';
      toast.error(message);
      appendAiText(`AI 内容生成失败：${message}`);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAction = (action: AICardAction, cardData?: Record<string, unknown>) => {
    if (action.type === 'generate') {
      void handleGenerateAction(action, cardData);
      return;
    }
    if (action.type === 'navigate' && action.target) {
      if (listRoutes.has(action.target)) {
        navigate(action.target);
      } else {
        toast.success('暂未开放详情页，已保留在当前页面');
      }
      return;
    }
    if (action.type === 'mock' && action.message) {
      toast.success(action.message);
      return;
    }
    toast.success(action.message ?? `${action.label}已生成`);
  };

  const renderResult = (result: Partial<AIQueryResult> | null | undefined) => {
    const cards = asArray(result?.cards);
    const actions = asArray(result?.actions);
    return (
      <div className="space-y-4">
      <p>{safeText(result?.answer, 'AI 助手暂时没有返回可展示的数据，请换一个问题再试。')}</p>
      {cards.length > 0 && (
        <div className="grid gap-3">
          {cards.map((card, index) => {
            const fields = asArray(card.fields);
            const cardActions = asArray(card.actions);
            const cardId = safeText(card.id, `card-${index}`);
            return (
            <div key={String(cardId)} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div>
                  <div className="font-bold text-gray-900">{safeText(card.title, '未命名结果')}</div>
                  {card.subtitle && <div className="text-sm text-gray-500 mt-0.5">{safeText(card.subtitle)}</div>}
                </div>
                <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full ${priorityClass(card.priority)}`}>
                  {priorityLabel(card.priority)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                {fields.map((field) => (
                  <div key={`${card.id}-${field.label}`}>
                    <span className="text-gray-500">{safeText(field.label)}：</span>
                    <span className="font-medium text-gray-800">{safeText(field.value)}</span>
                  </div>
                ))}
              </div>
              {cardActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {cardActions.map((action) => (
                    <button
                      key={`${card.id}-${action.label}`}
                      onClick={() => handleAction(action, card.data)}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => handleAction(action)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
    );
  };

  const handleSend = async (preset?: string) => {
    const userMsg = (preset ?? input).trim();
    if (!userMsg) return;

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await aiService.queryAssistant(userMsg);
      const aiContent = renderResult(result);
      setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`AI 助手请求失败：${message}`);
      setMessages(prev => [...prev, { role: 'ai', content: `AI 助手请求失败：${message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  const setSuggestedInput = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <button onClick={() => setMessages([])} className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            新对话
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">常用指令</h3>
            <div className="space-y-1">
              {quickQuestions.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} onClick={() => setSuggestedInput(item.text)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-lg transition-all flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-400" /> {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">历史记录</h3>
            <div className="space-y-1">
              {aiChatHistory.map(item => (
                <button key={item.id} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-all truncate flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-white">
        <div className="h-14 border-b border-gray-200 flex items-center px-6 justify-between bg-white/80 backdrop-blur-sm z-10 absolute top-0 w-full">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold text-gray-900">Astralink 灵枢智能助理</h2>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 pt-20 pb-32 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto opacity-80 pt-10">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                 <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">有什么我可以帮您的吗？</h2>
              <p className="text-gray-500 mb-8">我可以帮您分析真实教务数据、识别风险事项、整理运营待办。</p>

              <div className="grid grid-cols-2 gap-4 w-full text-left">
                {quickQuestions.map((item, index) => {
                  const colors = ['bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-red-500', 'bg-cyan-500'];
                  return (
                    <button key={item.label} onClick={() => setSuggestedInput(item.text)} className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-sm text-gray-700 group relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-1 h-full ${colors[index]} transform -translate-x-full group-hover:translate-x-0 transition-transform`}></div>
                      <span className="block font-bold text-gray-900 mb-1">{item.label}</span>
                      {item.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6 max-w-4xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5 text-purple-600" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${msg.role === 'user' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-800 shadow-sm'}`}>
                    {typeof msg.content === 'string' ? (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 shadow-sm flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-white via-white to-transparent pt-10">
          <div className="max-w-4xl mx-auto relative shadow-lg rounded-2xl bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入您的问题或指令，例如：哪些学生课时低于 5 小时？"
              className="w-full max-h-32 min-h-[56px] py-4 pl-4 pr-14 bg-transparent outline-none resize-none text-gray-900 text-sm"
              rows={1}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="absolute right-2 bottom-2 w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">
            AI 可能会犯错。请核实重要信息。
          </p>
        </div>
      </div>
    </div>
  );
}
