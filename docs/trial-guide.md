# Astralink 灵枢教务客户试用说明

## 系统访问地址

- Staging 地址：`https://<staging-frontend-domain>`
- 后端健康检查：`https://<staging-backend-domain>/api/health`
- 当前版本：`v0.4.5-trial-demo`

## 测试账号

以下账号仅用于本地 / staging 演示。生产环境必须修改密码，不要使用 demo 密码。

| 机构 | 管理员 | 教务主管 | 顾问 | 老师 | 财务 |
|------|--------|----------|------|------|------|
| 朗睿教育 | `admin@longrui.com / admin123` | `academic@longrui.com / academic123` | `advisor@longrui.com / advisor123` | `teacher@longrui.com / teacher123` | `finance@longrui.com / finance123` |
| 我来教育 | `admin@wolai.com / admin123` | `academic@wolai.com / academic123` | `advisor@wolai.com / advisor123` | `teacher@wolai.com / teacher123` | `finance@wolai.com / finance123` |
| 广外留学 | `admin@guangwai.com / admin123` | `academic@guangwai.com / academic123` | `advisor@guangwai.com / advisor123` | `teacher@guangwai.com / teacher123` | `finance@guangwai.com / finance123` |
| AmazingX | `admin@amazingx.com / admin123` | `academic@amazingx.com / academic123` | `advisor@amazingx.com / advisor123` | `teacher@amazingx.com / teacher123` | `finance@amazingx.com / finance123` |

角色可见内容：

- 管理员：全部菜单、系统设置、用户管理、权限矩阵。
- 教务主管：学员、课程、班级、排课、上课记录、请假补课、报告、AI。
- 顾问：负责学员、课时状态、家长报告、AI 跟进建议。
- 老师：本人排课、上课记录和老师反馈。
- 财务：订单课时、课时流水、课时导出。

## 建议试用流程

1. 使用管理员账号登录，先浏览首页看板和侧边栏完整菜单。
2. 进入学员管理，查看演示学生详情和风险状态。
3. 进入排课日历，新建一条排课并打开课程详情。
4. 从排课生成上课记录，填写并提交老师反馈。
5. 在上课记录中确认消课，再到订单课时查看余额和课时流水。
6. 创建一条请假补课申请，查看审批和安排补课状态。
7. 生成或打开家长报告，检查家长可见内容是否合适。
8. 进入 AI 教务助手，分别查询低课时学生、待提交反馈、待处理补课和待发送报告。
9. 打开数据导入导出页面，下载模板并查看导入批次。
10. 打开系统设置，查看机构配置、用户管理和权限矩阵。
11. 切换我来教育、广外留学、AmazingX 管理员账号，确认学员、课程、排课、AI 低课时查询只显示当前机构数据。

## 试用时重点反馈

- 学员档案字段是否覆盖朗睿实际管理需求。
- 排课、调课、请假和补课流程是否符合日常教务习惯。
- 老师反馈字段是否够用，是否需要不同课程类型的模板。
- 消课确认和课时流水是否符合财务追溯要求。
- 家长报告内容是否适合直接发送给家长。
- AI 教务助手哪些查询最有价值，哪些结论需要更谨慎。
- Excel 导入模板是否覆盖历史数据迁移字段。
- 系统设置和权限矩阵是否符合试用机构管理方式。
- 多机构账号之间的数据隔离是否清楚、可信。

## 常见问题

| 问题 | 说明 |
|------|------|
| 登录失败 | 请确认选择的是上方测试账号，或联系管理员确认账号是否被停用。 |
| 页面没有某个菜单 | 不同角色菜单不同；可切换管理员账号查看完整功能。 |
| AI 回答不像真实大模型 | 当前为规则型 AI / Mock AI，已读取真实数据库，后续可接入真实 AI API。 |
| 导入预览失败 | 请使用系统下载的模板，并至少填写一行有效数据。 |
| 数据与上次试用不同 | staging 演示环境可能重新执行 seed，演示数据会回到初始状态。 |

## 联系方式

- 项目负责人：`<name>`
- 邮箱：`<email@example.com>`
- 电话 / 企业微信：`<phone-or-wecom>`
