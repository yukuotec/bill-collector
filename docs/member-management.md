# 家庭成员管理

## 概述
家庭成员管理功能允许用户为家庭或团队设置多个成员，并将交易分配给特定成员。这使得多人共享账本时能够清晰地追踪每个人的支出。

## 功能特性

### 1. 成员管理
- **添加成员**: 创建新成员，指定姓名和颜色标识
- **编辑成员**: 修改成员姓名和颜色
- **删除成员**: 移除成员（相关交易会自动取消分配）
- **成员列表**: 在侧边栏和交易页面中显示所有成员

### 2. 交易分配
- **手动分配**: 在交易列表中通过下拉菜单为单个交易分配成员
- **批量分配**: 通过拖拽分配页面批量处理未分配的交易
- **智能分摊**: 基于规则引擎自动分配交易

### 3. 智能分配 (Smart Assignment)
系统提供两种智能分配机制：

#### 3.1 规则引擎 (Triage Rules)
基于预定义的关键词规则自动分配交易：
- **老公**: 游戏、数码、电子、汽车、烟、酒
- **老婆**: 化妆品、护肤、包包、服饰、美甲  
- **孩子**: 学校、培训、玩具、奶粉、童装
- **家庭**: 水电煤、物业、买菜、日用品

当导入新交易时，系统会自动应用这些规则进行分配。

#### 3.2 机器学习模式 (Pattern Learning)
系统会从用户的手动分配行为中学习模式：
- **特征提取**: 从商家名称、分类、描述中提取特征
- **模式识别**: 识别特定成员的消费模式
- **预测分配**: 对新交易进行智能预测
- **置信度分级**:
  - ≥70%: 自动分配
  - 30-69%: 建议分配（需要确认）
  - <30%: 不进行分配

### 4. 批量分配提示
当用户手动分配一个交易时，系统会检查是否存在相似的未分配交易：
- 如果找到2个或更多相似交易，会弹出确认对话框
- 用户可以选择"仅分配当前交易"或"批量应用到所有相似交易"
- 相似性基于：相同商家、相同分类、相似描述

### 5. 成员统计
- **仪表盘集成**: 在仪表盘显示各成员支出占比
- **详细统计**: 按年/月查看各成员的支出汇总
- **可视化**: 使用不同颜色区分各成员的支出

## 数据模型

### 成员表 (members)
```sql
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 交易分配历史 (assignment_history)
```sql
CREATE TABLE assignment_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### 分配模式 (assignment_patterns)
```sql
CREATE TABLE assignment_patterns (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  member_id TEXT NOT NULL,
  count INTEGER DEFAULT 1,
  confidence REAL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(feature_key, feature_value, member_id)
);
```

## API 接口

### 主进程 IPC 接口
- `get-members`: 获取所有成员列表
- `add-member`: 添加新成员
- `update-member`: 更新成员信息
- `delete-member`: 删除成员
- `set-transaction-member`: 为交易分配成员
- `get-member-summary`: 获取成员支出统计
- `apply-triage-rules`: 应用规则引擎
- `check-similar-assignments`: 检查相似交易分配
- `batch-assign-similar`: 批量分配相似交易

### CLI 命令
目前成员管理主要通过 GUI 界面操作，CLI 暂未提供相关命令。

## 使用场景

### 场景1: 家庭账本
- 夫妻共同记账，区分个人和家庭支出
- 为孩子设置单独的支出分类
- 自动生成家庭月度支出报告

### 场景2: 团队费用
- 小团队共享项目费用
- 追踪每个人的成本贡献
- 简化费用报销流程

### 场景3: 个人多账户
- 即使是个人用户，也可以用成员功能区分不同用途的支出
- 例如：工作支出 vs 个人支出

## 最佳实践

1. **合理设置成员**: 根据实际使用场景设置成员数量，避免过多导致管理复杂
2. **利用智能分配**: 初期手动分配一些交易，让系统学习你的分配模式
3. **定期审查**: 定期检查自动分配的结果，纠正错误的分配以改进学习效果
4. **结合规则引擎**: 根据家庭特点自定义关键词规则，提高分配准确率

## 未来增强

- [ ] 自定义规则引擎（用户可编辑关键词规则）
- [ ] 成员间转账和结算功能
- [ ] 预算按成员分配
- [ ] 成员专属报表导出