# 邮件自动捕获功能

## 目标
自动从邮箱下载账单和发票附件，无需手动操作。

## 功能
1. **邮箱配置** - 添加 IMAP 邮箱账户
2. **自动监控** - 定期检查邮箱新邮件
3. **附件识别** - 检测账单/发票附件（PDF, 图片）
4. **自动导入** - 解析附件并导入到系统

## 实现方案

### 1. 依赖
- 使用 `imap` npm 包连接 IMAP 邮箱
- 使用 `mailparser` 解析邮件

### 2. 数据库
```sql
-- 邮箱账户表
CREATE TABLE email_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER DEFAULT 993,
  smtp_host TEXT,
  smtp_port INTEGER,
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- 加密存储
  last_sync TEXT,
  created_at TEXT NOT NULL
);

-- 邮件记录表
CREATE TABLE email_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  subject TEXT,
  from_address TEXT,
  date TEXT,
  attachments TEXT, -- JSON array of attachment info
  processed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

### 3. IPC Handlers
- `add-email-account` - 添加邮箱账户
- `list-email-accounts` - 列出账户
- `delete-email-account` - 删除账户
- `sync-emails` - 手动触发同步
- `start-email-watch` - 启动后台监控
- `stop-email-watch` - 停止后台监控

### 4. 前端
- 设置页面添加邮箱管理
- 添加账户对话框（邮箱、IMAP配置、密码）
- 手动同步按钮
- 显示同步状态

## 关键逻辑
1. 连接 IMAP，搜索包含"账单"、"发票"、"消费"等关键词的邮件
2. 下载附件到临时目录
3. 调用现有的 parse 函数处理
4. 标记已处理，避免重复

## 配置示例
- 163邮箱: imap.163.com:993
- QQ邮箱: imap.qq.com:993
- Gmail: imap.gmail.com:993

---
实现时先做 MVP：手动触发同步 + 基本的 IMAP 连接。
