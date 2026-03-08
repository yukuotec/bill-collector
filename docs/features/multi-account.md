# 多账户支持

> **状态**: ✅ 已实现 (2026-03-08)

## 功能概述

管理多个银行账户、信用卡、现金钱包，并将交易关联到具体账户。

## 支持的账户类型

| 类型 | 说明 | 图标 |
|------|------|------|
| `bank` | 银行卡/储蓄卡 | 🏦 |
| `credit` | 信用卡 | 💳 |
| `cash` | 现金 | 💵 |
| `alipay` | 支付宝 | 💙 |
| `wechat` | 微信支付 | 💚 |
| `other` | 其他 | 📦 |

## 账户属性

- **名称**: 账户显示名称（如：招商信用卡、建行储蓄卡）
- **类型**: 上述6种类型之一
- **余额**: 当前余额（可选，用于对账）
- **颜色**: 可视化标识颜色

## 功能特性

### 1. 账户管理
- 添加/编辑/删除账户
- 查看账户列表及余额
- 点击余额可直接编辑

### 2. 交易关联
- 导入账单时可选择目标账户
- 交易列表中可手动选择/修改账户
- 删除账户时，关联交易自动解绑（account_id 设为 NULL）

### 3. 账户筛选与统计
- 交易列表支持按账户筛选
- 仪表盘显示账户支出统计图表
- 支持按年/月查看账户支出汇总

## 数据库 Schema

```sql
-- 账户表
CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,              -- bank/credit/cash/alipay/wechat/other
  balance REAL DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 交易表添加账户外键
ALTER TABLE transactions ADD COLUMN account_id TEXT;
```

## API 接口

### IPC Handlers
- `get-accounts`: 获取所有账户
- `add-account`: 添加账户
- `update-account`: 更新账户
- `delete-account`: 删除账户
- `set-transaction-account`: 设置交易账户
- `get-account-summary`: 获取账户支出统计
- `update-account-balance`: 更新账户余额

### Preload API
```typescript
window.electronAPI.getAccounts(): Promise<Account[]>
window.electronAPI.addAccount(id, name, type, balance, color): Promise<void>
window.electronAPI.updateAccount(id, name, type, balance, color): Promise<void>
window.electronAPI.deleteAccount(id): Promise<void>
window.electronAPI.setTransactionAccount(transactionId, accountId): Promise<void>
window.electronAPI.getAccountSummary(year, month?): Promise<AccountSummary[]>
window.electronAPI.updateAccountBalance(id, balance): Promise<void>
```

## 界面截图

- **账户管理页面**: `/accounts` - 账户列表、添加/编辑/删除
- **导入页面**: 导入时可选择目标账户
- **交易列表**: 新增"账户"列，支持筛选
- **仪表盘**: 新增账户支出统计图表

## 测试

测试文件: `tests/accounts.test.js`

```bash
# 运行账户相关测试
node --test tests/accounts.test.js
```

覆盖场景:
- 账户 CRUD 操作
- 交易关联/解绑
- 账户支出统计
- 删除账户时交易处理
- 所有账户类型验证

## 相关文档

- [SPEC.md](../SPEC.md) - 技术规格
- [Database Schema](../SPEC.md#data-schema) - 完整数据库结构
