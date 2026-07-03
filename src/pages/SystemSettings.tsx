import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ShieldCheck, Settings as SettingsIcon, Users } from "lucide-react";
import { settingsService, type ManagedUser, type PermissionMatrix, type SystemSettings } from "../services/settingsService";
import { useAuth } from "../context/AuthContext";

const roleLabels: Record<ManagedUser["role"], string> = {
  admin: "管理员",
  academic_manager: "教务主管",
  advisor: "顾问",
  teacher: "老师",
  finance: "财务",
};

const actionLabels: Record<string, string> = {
  view: "可查看",
  create: "可新增",
  edit: "可编辑",
  delete: "可删除",
  export: "可导出",
  approve: "可审批",
  send: "可发送",
  confirmDeduction: "可确认消课",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <span className="text-gray-700">{label}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
    </label>
  );
}

export function SystemSettings() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin";
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [permissions, setPermissions] = useState<PermissionMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ displayName: "", email: "", password: "demo123", role: "advisor" as ManagedUser["role"], status: "active" as ManagedUser["status"] });

  const load = async () => {
    setLoading(true);
    try {
      const [settingsData, usersData, permissionData] = await Promise.all([
        settingsService.getSettings(),
        settingsService.listUsers(),
        settingsService.getPermissions(),
      ]);
      setSettings(settingsData);
      setUsers(usersData);
      setPermissions(permissionData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "系统设置加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async () => {
    if (!settings || !canEdit) return;
    try {
      const saved = await settingsService.updateSettings(settings);
      setSettings(saved);
      toast.success("系统设置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const createUser = async () => {
    if (!newUser.displayName.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      toast.error("请填写姓名、邮箱和初始密码");
      return;
    }
    try {
      await settingsService.createUser(newUser);
      toast.success("用户已创建");
      setNewUser({ displayName: "", email: "", password: "demo123", role: "advisor", status: "active" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建用户失败");
    }
  };

  const updateStatus = async (target: ManagedUser) => {
    try {
      await settingsService.updateUserStatus(target.id, target.status === "active" ? "disabled" : "active");
      toast.success(target.status === "active" ? "用户已停用" : "用户已启用");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "状态更新失败");
    }
  };

  const resetPassword = async (target: ManagedUser) => {
    const password = window.prompt(`请输入 ${target.displayName} 的新密码`, "demo123");
    if (!password) return;
    try {
      await settingsService.resetPassword(target.id, password);
      toast.success("密码已重置");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置密码失败");
    }
  };

  if (loading || !settings) {
    return <div className="bg-white border border-gray-200 rounded-xl p-8 text-gray-500">正在加载系统设置...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
        <p className="text-sm text-gray-500 mt-1">客户试用、账号权限和部署前配置。</p>
      </div>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900"><SettingsIcon className="w-5 h-5 text-blue-600" />机构与基础配置</div>
          {canEdit && <button onClick={saveSettings} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium">保存设置</button>}
        </div>
        <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Field label="机构名称"><input disabled={!canEdit} value={settings.organizationName} onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="机构简称"><input disabled={!canEdit} value={settings.shortName} onChange={(e) => setSettings({ ...settings, shortName: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="联系电话"><input disabled={!canEdit} value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="联系邮箱"><input disabled={!canEdit} value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="Logo 文本"><input disabled={!canEdit} value={settings.logoText} onChange={(e) => setSettings({ ...settings, logoText: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="环境"><select disabled={!canEdit} value={settings.environment} onChange={(e) => setSettings({ ...settings, environment: e.target.value as SystemSettings["environment"] })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"><option value="local">local</option><option value="staging">staging</option><option value="production">production</option></select></Field>
          <Field label="地址"><input disabled={!canEdit} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="版本号"><input disabled={!canEdit} value={settings.version} onChange={(e) => setSettings({ ...settings, version: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="低课时阈值"><input disabled={!canEdit} type="number" value={settings.academicConfig.lowCreditThreshold} onChange={(e) => setSettings({ ...settings, academicConfig: { ...settings.academicConfig, lowCreditThreshold: Number(e.target.value) } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="默认课时时长"><input disabled={!canEdit} type="number" value={settings.academicConfig.defaultLessonHours} onChange={(e) => setSettings({ ...settings, academicConfig: { ...settings.academicConfig, defaultLessonHours: Number(e.target.value) } })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></Field>
        </div>
        <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Toggle disabled={!canEdit} label="允许课时透支" checked={settings.academicConfig.allowCreditOverdraft} onChange={(v) => setSettings({ ...settings, academicConfig: { ...settings.academicConfig, allowCreditOverdraft: v } })} />
          <Toggle disabled={!canEdit} label="启用冲突检测" checked={settings.academicConfig.enableConflictDetection} onChange={(v) => setSettings({ ...settings, academicConfig: { ...settings.academicConfig, enableConflictDetection: v } })} />
          <Toggle disabled={!canEdit} label="启用请假补课审批" checked={settings.academicConfig.enableLeaveApproval} onChange={(v) => setSettings({ ...settings, academicConfig: { ...settings.academicConfig, enableLeaveApproval: v } })} />
          <Toggle disabled={!canEdit} label="启用家长报告审核" checked={settings.academicConfig.enableReportReview} onChange={(v) => setSettings({ ...settings, academicConfig: { ...settings.academicConfig, enableReportReview: v } })} />
          <Toggle disabled={!canEdit} label="启用家长通知" checked={settings.notificationConfig.enableParentNotification} onChange={(v) => setSettings({ ...settings, notificationConfig: { ...settings.notificationConfig, enableParentNotification: v } })} />
          <Toggle disabled={!canEdit} label="启用老师提醒" checked={settings.notificationConfig.enableTeacherReminder} onChange={(v) => setSettings({ ...settings, notificationConfig: { ...settings.notificationConfig, enableTeacherReminder: v } })} />
          <Toggle disabled={!canEdit} label="启用顾问续费提醒" checked={settings.notificationConfig.enableAdvisorRenewalReminder} onChange={(v) => setSettings({ ...settings, notificationConfig: { ...settings.notificationConfig, enableAdvisorRenewalReminder: v } })} />
          <Toggle disabled={!canEdit} label="AI 教务助手" checked={settings.aiConfig.enableAssistant} onChange={(v) => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, enableAssistant: v } })} />
          <Toggle disabled={!canEdit} label="AI 续费建议" checked={settings.aiConfig.enableRenewalSuggestion} onChange={(v) => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, enableRenewalSuggestion: v } })} />
          <Toggle disabled={!canEdit} label="AI 报告润色" checked={settings.aiConfig.enableReportPolish} onChange={(v) => setSettings({ ...settings, aiConfig: { ...settings.aiConfig, enableReportPolish: v } })} />
        </div>
        <div className="px-5 pb-5 text-sm text-gray-500">通知渠道占位：企业微信 / 邮件 / 短信；当前 AI 模式：{settings.aiConfig.mode === "rule_based" ? "规则型 AI" : "Mock AI"}，真实 AI API Key：{settings.aiConfig.apiKeyStatus}</div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 font-bold text-gray-900"><Users className="w-5 h-5 text-blue-600" />用户账号管理</div>
        {canEdit && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-3 border-b border-gray-100">
            <input placeholder="姓名" value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="邮箱" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <input placeholder="初始密码" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as ManagedUser["role"] })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button onClick={createUser} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium">新增用户</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500"><tr>{["姓名", "邮箱", "角色", "状态", "机构", "关联信息", "最近登录", "创建时间", "操作"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.displayName}</td>
                  <td className="px-4 py-3">{item.email}</td>
                  <td className="px-4 py-3">{roleLabels[item.role]}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${item.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{item.status === "active" ? "启用" : "停用"}</span></td>
                  <td className="px-4 py-3">{item.organizationName}</td>
                  <td className="px-4 py-3">{item.teacherName ? `老师：${item.teacherName}` : item.role === "advisor" ? `负责学员 ${item.advisorStudentCount}` : "-"}</td>
                  <td className="px-4 py-3">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "-"}</td>
                  <td className="px-4 py-3">{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 space-x-2">
                    {canEdit ? (
                      <>
                        <button onClick={() => updateStatus(item)} className="text-blue-600 hover:text-blue-800">{item.status === "active" ? "停用" : "启用"}</button>
                        <button onClick={() => resetPassword(item)} className="text-blue-600 hover:text-blue-800">重置密码</button>
                      </>
                    ) : <span className="text-gray-400">只读</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 font-bold text-gray-900"><ShieldCheck className="w-5 h-5 text-blue-600" />角色权限矩阵</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr><th className="px-4 py-3 text-left">模块</th>{permissions?.roles.map((role) => <th key={role} className="px-4 py-3 text-left">{roleLabels[role as ManagedUser["role"]]}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {permissions?.modules.map((module) => (
                <tr key={module.module}>
                  <td className="px-4 py-3 font-medium text-gray-900">{module.module}</td>
                  {permissions.roles.map((role) => (
                    <td key={`${module.module}-${role}`} className="px-4 py-3 text-gray-600">
                      {permissions.actions.filter((action) => module.permissions[role]?.[action]).map((action) => actionLabels[action]).join(" / ") || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
