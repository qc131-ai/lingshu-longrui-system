import { aiProposedActionSchema, forbiddenAiActionTypes, type AiProviderResponse } from "./aiSchemas.js";

const highRiskPatterns = [
  /删除|删掉|清空|drop|delete/i,
  /扣课时|消课|扣减|扣除|改余额|修改余额/i,
  /发送报告|发报告|发送给家长|发给家长/i,
  /改权限|修改权限|角色|管理员权限/i,
  /重置密码|改密码|创建用户|新增用户/i,
  /导出|下载全部|导出数据/i,
];

export function detectForbiddenRequest(message: string) {
  if (!highRiskPatterns.some((pattern) => pattern.test(message))) return null;
  return "该请求涉及删除、扣课时、发送、权限、密码或导出等高风险操作。本阶段 AI Agent 只能查询和生成待确认建议，不会执行该类动作。";
}

export function sanitizeProviderResponse(input: AiProviderResponse, message: string): AiProviderResponse {
  const forbiddenWarning = detectForbiddenRequest(message);
  if (forbiddenWarning) {
    return {
      answer: "我不能执行或建议这类高风险操作。本阶段可以帮你查询数据、生成沟通草稿或提出低风险待确认动作。",
      intent: input.intent || "restricted_action",
      cards: [],
      proposedActions: [],
      warnings: [...input.warnings, forbiddenWarning],
      confidence: Math.min(input.confidence, 0.4),
    };
  }

  const proposedActions = input.confidence < 0.5
    ? []
    : input.proposedActions
        .map((action) => aiProposedActionSchema.safeParse(action))
        .filter((result): result is { success: true; data: typeof input.proposedActions[number] } => result.success)
        .map((result) => result.data)
        .filter((action) => !forbiddenAiActionTypes.includes(action.actionType as never));

  return { ...input, proposedActions };
}
