# 多账户支持

## 目标
管理多个银行账户、信用卡、现金钱包。

## 现状
目前交易只有一个 source 字段（支付宝/微信/银行），没有独立的账户概念。

## 设计

### 账户类型
- 银行卡
- 信用卡
- 现金
- 支付宝
- 微信
- 其他

### 账户属性
- 名称（如：招商信用卡、建行储蓄卡）
- 类型（银行/信用卡/现金/电子钱包）
- 余额（可选，用于对账）
- 颜色（用于区分）

### 功能
1. **账户管理**
   - 添加/编辑/删除账户
   - 查看账户列表

2. **交易关联**
   - 导入时自动关联账户
   - 手动选择账户
   - 可选（不是必填）

3. **账户筛选**
   - 交易列表可按账户筛选
   - Dashboard 可按账户统计

## 实现

### 1. 数据库
```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- bank/credit/cash/alipay/wechat/other
  balance REAL DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- transactions 表已有 account 字段或需要添加
ALTER TABLE transactions ADD COLUMN account_id TEXT REFERENCES accounts(id);
```

### 2. 后端 API
- getAccounts / addAccount / updateAccount / deleteAccount
- getTransactions 可按 account_id 筛选

### 3. 前端
- 设置页面添加账户管理
- 交易导入时可选择账户
- 交易列表筛选

## 验收
- 可添加多种类型的账户
- 交易可关联账户
- 可按账户筛选交易
