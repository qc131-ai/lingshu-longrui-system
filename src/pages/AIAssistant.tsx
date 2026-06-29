import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Sparkles, Send, Bot, User, Menu, MessageSquare, Clock, BookOpen, Settings, Plus, ChevronRight, AlertCircle, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { aiService } from '../services/aiService';

const aiChatHistory = aiService.getHistorySync();

export function AIAssistant() {
  const { students } = useAppContext();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string | ReactNode}[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    try {
      const result = await aiService.queryAssistant(userMsg, students);
      let aiContent: string | ReactNode;

      if (result.intent === 'credit_warning') {
        const warningStudents = result.students;
        aiContent = (
          <div className="space-y-4">
            <p>我已找到 {warningStudents.length} 名剩余课时低于 5 小时的学生：</p>
            <div className="grid gap-3">
              {warningStudents.map(s => (
                <div key={s.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{s.name}</span>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">剩余 {s.remainingCredits} 课时</span>
                    </div>
                    <span className="text-xs text-gray-500">顾问: Liang</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    当前风险等级：{s.riskStatus === 'high' ? '高风险' : '中风险'}
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700">通知顾问</button>
                    <button className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100">生成续费话术</button>
                    <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100">查看档案</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      } else if (result.intent === 'report') {
        aiContent = (
          <div className="space-y-4">
            <p>我已为您生成本周的家长报告草稿，请查阅：</p>
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <FileText className="w-16 h-16 text-blue-600" />
              </div>
              <h4 className="font-bold text-gray-900 mb-2">周报摘要 - 韩梅梅</h4>
              <p className="text-sm text-gray-600 leading-relaxed mb-4 relative z-10">
                家长您好！本周韩梅梅同学在托福听力上表现优异，正确率提升至 85%。但口语练习打卡延迟了2次，建议周末重点复习 Task 2 的模板。
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700">发送给家长</button>
                <button className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100">编辑报告</button>
              </div>
            </div>
          </div>
        );
      } else if (result.intent === 'makeup') {
        aiContent = (
          <div className="space-y-4">
            <p>以下是本周待安排的补课提醒：</p>
            <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm bg-orange-50/50">
              <div className="flex items-center gap-2 mb-2 text-orange-700">
                <AlertCircle className="w-4 h-4" />
                <span className="font-bold">{result.count} 条补课待处理</span>
              </div>
              <ul className="text-sm text-gray-700 space-y-2 mb-3">
                {result.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <button className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" /> 立即安排补课
              </button>
            </div>
          </div>
        );
      } else {
        aiContent = result.fallbackText;
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiContent }]);
    } finally {
      setIsTyping(false);
    }
  };

  const setSuggestedInput = (text: string) => {
    setInput(text);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Left Sidebar (History & Prompts) */}
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
              <button onClick={() => setSuggestedInput('哪些学生课时低于 5 小时？')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-lg transition-all flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-gray-400" /> 课时预警查询
              </button>
              <button onClick={() => setSuggestedInput('帮我生成韩梅梅的家长报告')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-lg transition-all flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-400" /> 学情报告生成
              </button>
              <button onClick={() => setSuggestedInput('安排本周补课提醒')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-lg transition-all flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-gray-400" /> 补课排期提醒
              </button>
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

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-white">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 flex items-center px-6 justify-between bg-white/80 backdrop-blur-sm z-10 absolute top-0 w-full">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold text-gray-900">Astralink 灵枢智能助理</h2>
          </div>
          <button className="text-gray-400 hover:text-gray-600">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-20 pb-32 space-y-6">
          
          {messages.length === 0 ? (
            /* Welcome State */
            <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto opacity-80 pt-10">
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                 <Sparkles className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">有什么我可以帮您的吗？</h2>
              <p className="text-gray-500 mb-8">我可以帮您分析数据、智能排课、或者生成家长报告。</p>

              <div className="grid grid-cols-2 gap-4 w-full text-left">
                <button onClick={() => setSuggestedInput('生成李佳怡近期的学习进度报告')} className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-sm text-gray-700 group relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
                   <span className="block font-bold text-gray-900 mb-1">查询学生画像</span>
                   生成李佳怡近期的学习进度报告
                </button>
                <button onClick={() => setSuggestedInput('为周末的托福班寻找空闲教室')} className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-sm text-gray-700 group relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-green-500 transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
                   <span className="block font-bold text-gray-900 mb-1">智能排课建议</span>
                   为周末的托福班寻找空闲教室
                </button>
                <button onClick={() => setSuggestedInput('哪些学生课时低于 5 小时？')} className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-sm text-gray-700 group relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
                   <span className="block font-bold text-gray-900 mb-1">课时预警分析</span>
                   列出本月可能课时不足的学生
                </button>
                <button onClick={() => setSuggestedInput('帮我润色张子涵的今日课后评语')} className="p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors text-sm text-gray-700 group relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 transform -translate-x-full group-hover:translate-x-0 transition-transform"></div>
                   <span className="block font-bold text-gray-900 mb-1">课堂反馈优化</span>
                   帮我润色张子涵的今日课后评语
                </button>
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

        {/* Input Area */}
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
              placeholder="输入您的问题或指令，例如：帮我分析张子涵的近期成绩趋势..."
              className="w-full max-h-32 min-h-[56px] py-4 pl-4 pr-14 bg-transparent outline-none resize-none text-gray-900 text-sm"
              rows={1}
            />
            <button 
              onClick={handleSend}
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
