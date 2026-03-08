# 记账小助手 - 文档导航

## 快速开始

- [产品规格 (SPEC.md)](../SPEC.md) - 完整产品规格说明书
- [开发计划 (PLAN.md)](../PLAN.md) - 分阶段开发计划
- [架构设计](./ARCHITECTURE.md) - 技术架构说明

## 阶段计划 (docs/plans/)

| 阶段 | 状态 | 文档 |
|------|------|------|
| Phase 1: 核心记账功能 | ✅ 已完成 | [2026-02-20-phase-1-completed.md](./plans/2026-02-20-phase-1-completed.md) |
| Phase 2: 数据收集增强 | 🚧 设计中 | [2026-03-08-phase-2-design.md](./plans/2026-03-08-phase-2-design.md) |
| Dashboard 钻取功能 | ✅ 已完成 | [2026-02-22-dashboard-drilldown-design.md](./plans/2026-02-22-dashboard-drilldown-design.md) |

## 功能文档 (docs/features/)

### 核心功能
- [多账户管理](./features/multi-account.md) - 银行卡/信用卡/现金/电子钱包管理
- [家庭成员管理](./features/member-management.md) - 成员创建、分配、智能分摊
- [智能分配](./features/smart-assignment.md) - 规则引擎与机器学习分配
- [标签管理](./features/tag-management.md) - 自定义标签系统

### 数据与导入
- [拖拽分配页面](./features/drag-assign.md) - 直观的交易分配界面
- [邮件自动捕获](./features/email-auto-capture.md) - IMAP邮件监控与账单下载

### 预算与提醒
- [预算与提醒](./features/budget-alerts.md) - 月度/分类预算与超支提醒

## 使用指南 (docs/guides/)

- [CLI 命令参考](./guides/cli-commands.md) - 完整命令行工具文档

## 架构决策记录 (docs/adr/)

（待添加）

## 文档维护

### 命名规范
- 计划文档: `YYYY-MM-DD-phase-N-[status].md` 或 `YYYY-MM-DD-feature-name-design.md`
- 功能文档: `kebab-case-feature-name.md`
- 指南文档: `kebab-case-topic.md`

### 文档状态标记
- ✅ 已完成 - 功能已实现，文档已验证
- 🚧 设计中 - 设计阶段，待实现
- 📝 草稿 - 初步想法，待完善
- 🔄 已过时 - 需要更新
