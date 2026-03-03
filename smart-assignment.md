# 智能分摊功能 - ML 账单分配

## 目标
通过学习用户的历史分配模式，自动为新导入的账单分配成员。

## 核心思路
- 学习：记录用户手动分配的交易特征
- 预测：利用学到的模式预测新交易应该分配给谁

## 实现方案

### 1. 数据库新增表

#### assignment_history (分配历史)
```sql
CREATE TABLE assignment_history (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,   -- 特征键: "counterparty:海底捞", "category:餐饮", "description:零食"
  feature_value TEXT NOT NULL, -- 特征值
  created_at TEXT NOT NULL
);
```

#### assignment_patterns (学习到的模式)
```sql
CREATE TABLE assignment_patterns (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL,
  feature_value TEXT NOT NULL,
  member_id TEXT NOT NULL,
  count INTEGER DEFAULT 1,      -- 出现次数
  confidence REAL DEFAULT 0,    -- 置信度 (0-1)
  updated_at TEXT NOT NULL,
  UNIQUE(feature_key, feature_value, member_id)
);
```
- feature_key: "counterparty" | "category" | "description" | "merchant_keyword"
- 置信度 = 该模式出现次数 / 总次数

### 2. 学习逻辑

当用户手动分配一笔交易给某个成员时：
```
1. 提取交易特征：counterparty, category, description, merchant关键词
2. 更新 assignment_history 记录
3. 重新计算 assignment_patterns 的置信度
```

### 3. 预测逻辑

导入新交易时：
```
1. 提取交易特征
2. 查询 assignment_patterns，匹配 feature_value
3. 找到置信度最高的成员
4. 如果置信度 >= 0.7（70%），自动分配
5. 如果置信度 0.3-0.7，建议但不自动
6. 如果 < 0.3，不分配
```

### 4. 后端 API

- `learn-assignment` - 学习一次分配（用户手动分配时调用）
- `predict-member` - 预测单笔交易应该分配给谁
- `apply-smart-assignment` - 批量预测并自动分配（导入时调用）
- `get-patterns` - 查看学习到的模式
- `delete-pattern` - 删除某条模式

### 5. 前端

- 手动分配交易时自动触发学习
- 可以在设置页面查看/管理学习到的模式
- 导入时可以显示智能分摊结果

## 参考

项目位置: /Users/yukuo/workspace/expense-tracker
现有技术栈: Electron + React + TypeScript + SQLite (sql.js)

请实现上述功能，包括：
1. database.ts - 添加表和学习/预测函数
2. ipc.ts - 添加相关 handlers
3. types.ts - 如需要新类型
4. 修改现有的手动分配逻辑自动触发学习

完成后运行 npm test 和 npm run build。
