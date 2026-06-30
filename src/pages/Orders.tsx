import { useEffect, useState, type FormEvent } from 'react';
import { Search, Filter, CreditCard, Clock, CheckCircle2, AlertCircle, Plus, ChevronRight, Coins, Settings2, Sparkles, FileText } from 'lucide-react';
import type { CreditAccount, CreditTransaction, RenewalSuggestion } from '../types';
import { useAppContext } from '../context/AppContext';
import { Modal } from '../components/ui/Modal';
import { creditService } from '../services/creditService';
import { aiService } from '../services/aiService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { can } from '../auth/permissions';

const ordersPageStats = creditService.getOrdersPageStatsSync();
const creditLedgerSummary = creditService.getLedgerSummarySync();

export function Orders() {
  const { orders, students, updateStudent, addOrder } = useAppContext();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [transactions, setTransactions] = useState<CreditTransaction[]>(orders);
  const [lowBalanceAccounts, setLowBalanceAccounts] = useState<CreditAccount[]>([]);
  
  // Modals state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<RenewalSuggestion | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    studentId: '',
    courseName: '',
    adjustType: 'purchase',
    creditsAmount: 0,
    amount: 0,
    notes: ''
  });

  const refreshCredits = async () => {
    try {
      const [latestTransactions, lowAccounts] = await Promise.all([
        creditService.listTransactions(),
        creditService.listAccounts({ lowBalance: true }),
      ]);
      setTransactions(latestTransactions);
      setLowBalanceAccounts(lowAccounts);
    } catch (error) {
      toast.error(`课时数据加载失败：${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  useEffect(() => {
    refreshCredits();
  }, []);

  const filteredOrders = transactions.filter(o => 
    o.id.includes(searchTerm) || o.studentName.includes(searchTerm)
  );

  const handleAdjustCredits = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || formData.creditsAmount === 0) {
      toast.error('请选择学员并输入调整课时');
      return;
    }

    const student = students.find(s => s.id === formData.studentId);
    if (!student) return;

    const result = await creditService.adjustCredits({
      student,
      adjustType: formData.adjustType,
      creditsAmount: formData.creditsAmount,
      courseName: formData.courseName,
      amount: formData.amount,
      notes: formData.notes,
    });

    updateStudent(result.student.id, { remainingCredits: result.student.remainingCredits });
    addOrder(result.transaction);
    setTransactions(prev => [result.transaction, ...prev]);
    await refreshCredits();

    toast.success(`已成功为 ${student.name} 调整课时`);
    setIsAdjustModalOpen(false);
    setFormData({ studentId: '', courseName: '', adjustType: 'purchase', creditsAmount: 0, amount: 0, notes: '' });
  };

  const handleGenerateAISuggestion = async () => {
    setIsGeneratingAI(true);
    setAiSuggestion(null);
    try {
      const suggestion = await aiService.generateRenewalSuggestion();
      setAiSuggestion(suggestion);
      toast.success('AI 续费建议已生成');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">订单与课时</h1>
        <div className="flex gap-3">
          {can(user?.role, 'adjustCredit') && (
            <button onClick={() => setIsAdjustModalOpen(true)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
              <Settings2 className="w-4 h-4" />
              课时调整
            </button>
          )}
          <button onClick={() => toast.success('报表导出中...')} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            导出流水
          </button>
          {can(user?.role, 'adjustCredit') && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              新建订单
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">本月新增订单</p>
               <h3 className="text-2xl font-bold text-gray-900 mt-1">{ordersPageStats.monthlyNewOrders}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
               <CreditCard className="w-5 h-5 text-blue-600" />
             </div>
           </div>
         </div>
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">本月收款 (元)</p>
               <h3 className="text-2xl font-bold text-green-600 mt-1">{ordersPageStats.monthlyRevenue.toLocaleString()}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
               <CheckCircle2 className="w-5 h-5 text-green-600" />
             </div>
           </div>
         </div>
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">待付款订单</p>
               <h3 className="text-2xl font-bold text-orange-600 mt-1">{ordersPageStats.pendingOrders}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
               <AlertCircle className="w-5 h-5 text-orange-600" />
             </div>
           </div>
         </div>
         <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
           <div className="flex justify-between items-start">
             <div>
               <p className="text-sm font-medium text-gray-500">课时预警学生</p>
               <h3 className="text-2xl font-bold text-red-600 mt-1">{ordersPageStats.warningStudents}</h3>
             </div>
             <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
               <Clock className="w-5 h-5 text-red-600" />
             </div>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Orders Table */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="搜索订单号、学生姓名..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 w-full sm:w-auto justify-center">
                <Filter className="w-4 h-4" />
                状态筛选
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-4">订单号</th>
                  <th scope="col" className="px-6 py-4">学生/课程</th>
                  <th scope="col" className="px-6 py-4">金额</th>
                  <th scope="col" className="px-6 py-4">变动课时</th>
                  <th scope="col" className="px-6 py-4">日期</th>
                  <th scope="col" className="px-6 py-4">状态</th>
                  <th scope="col" className="px-6 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="bg-white border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {order.id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{order.studentName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{order.courseName}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {order.amount > 0 ? `¥${order.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${order.creditsAdded > 0 ? 'text-blue-600' : 'text-orange-600'} font-medium`}>
                        {order.creditsAdded > 0 ? `+${order.creditsAdded}` : order.creditsAdded} 课时
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {order.date}
                    </td>
                    <td className="px-6 py-4">
                      {order.status === 'paid' ? (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">完成/已付款</span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">待付款</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Credits Ledger Summary & AI */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Coins className="w-5 h-5 text-gray-400" />
              课时台账摘要
            </h3>
            
            <div className="space-y-4">
               <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">系统总剩余课时</p>
                  <div className="text-2xl font-bold text-gray-900">{creditLedgerSummary.totalRemainingHours} <span className="text-sm font-normal text-gray-500">h</span></div>
               </div>
               
               <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">本月已消耗</p>
                  <div className="text-2xl font-bold text-blue-600">{creditLedgerSummary.monthlyConsumedHours} <span className="text-sm font-normal text-gray-500">h</span></div>
               </div>

               <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                  <p className="text-sm text-red-600 font-medium mb-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    课时预警 (低于10课时)
                  </p>
                  <div className="space-y-2 mt-3">
                    {lowBalanceAccounts.slice(0, 3).map(account => (
                      <div key={account.id} className="flex justify-between items-center text-sm">
                        <span className="text-gray-700">{account.studentName || account.studentId}</span>
                        <span className="font-bold text-red-600">{account.remainingHours} h</span>
                      </div>
                    ))}
                    <button className="w-full mt-2 text-xs text-red-600 hover:text-red-700 font-medium text-center">
                      查看全部预警学生 →
                    </button>
                  </div>
               </div>
            </div>
          </div>

          {/* AI Renewal Suggestion */}
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-xl shadow-sm p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-32 h-32 text-white" />
            </div>
            <div className="relative z-10">
              <h3 className="font-bold flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                智能续费建议
              </h3>
              <p className="text-sm text-purple-100 mb-4 leading-relaxed">
                分析学生近期学习进度、成绩波动与剩余课时，自动生成顾问跟进策略和话术。
              </p>
              
              {!aiSuggestion ? (
                <button 
                  onClick={handleGenerateAISuggestion}
                  disabled={isGeneratingAI}
                  className="w-full bg-white/20 hover:bg-white/30 border border-white/30 text-white font-medium rounded-lg text-sm px-4 py-2.5 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingAI ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGeneratingAI ? '生成中...' : '生成续费分析'}
                </button>
              ) : (
                <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm border border-white/20 mt-4 space-y-3 text-sm">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="font-bold">{aiSuggestion.name}</span>
                    <span className="text-red-200">{aiSuggestion.credits} 课时剩余</span>
                  </div>
                  <div><span className="text-purple-200">课程：</span>{aiSuggestion.course} ({aiSuggestion.progress})</div>
                  <div><span className="text-purple-200">风险分析：</span>{aiSuggestion.risk}</div>
                  <div className="bg-white text-gray-900 p-3 rounded mt-2">
                    <div className="text-xs text-gray-500 mb-1">推荐话术：</div>
                    {aiSuggestion.script}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Credits Modal */}
      <Modal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} title="课时调整">
        <form onSubmit={handleAdjustCredits} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">选择学员 <span className="text-red-500">*</span></label>
            <select value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
              <option value="">请选择...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} (剩 {s.remainingCredits} 课时)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联课程</label>
            <input type="text" value={formData.courseName} onChange={e => setFormData({...formData, courseName: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="如：托福强化班" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">调整类型</label>
              <select value={formData.adjustType} onChange={e => setFormData({...formData, adjustType: e.target.value})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm">
                <option value="purchase">购买 (+)</option>
                <option value="gift">赠送 (+)</option>
                <option value="transfer_in">转入 (+)</option>
                <option value="makeup_return">补课返还 (+)</option>
                <option value="deduct">正常消课 (-)</option>
                <option value="refund">退费扣减 (-)</option>
                <option value="transfer_out">转出 (-)</option>
                <option value="manual">手动调整</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">变动课时数 <span className="text-red-500">*</span></label>
              <input type="number" min="0" value={formData.creditsAmount} onChange={e => setFormData({...formData, creditsAmount: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="正数" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">关联金额 (¥)</label>
            <input type="number" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" placeholder="非必须" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">操作备注</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-sm resize-none" placeholder="填写调整原因" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">取消</button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">确认调整</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
