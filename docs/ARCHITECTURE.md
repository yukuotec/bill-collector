# 记账小助手 - 架构文档

## 整体架构

记账小助手采用 Electron + React + TypeScript 技术栈，遵循典型的桌面应用架构模式：

```
expense-tracker/
├── src/
│   ├── main/           # Electron 主进程 (Node.js)
│   ├── renderer/       # 渲染进程 (React + TypeScript)
│   ├── shared/         # 共享类型和工具函数
│   └── parsers/        # 数据解析器
├── docs/              # 项目文档
└── tests/             # 测试文件
```

## 主要组件

### 1. Electron 主进程 (Main Process)

**职责：**
- 应用生命周期管理
- 数据库操作 (SQLite via sql.js)
- 文件系统操作
- IPC 通信处理
- 后台任务处理 (邮件同步、智能分配等)

**关键文件：**
- `src/main/index.ts` - 应用入口点
- `src/main/database.ts` - 数据库管理
- `src/main/ipc.ts` - IPC 处理器
- `src/main/email.ts` - 邮件同步逻辑

### 2. 渲染进程 (Renderer Process)

**职责：**
- 用户界面渲染
- 状态管理
- 用户交互处理
- 路由导航

**关键文件：**
- `src/renderer/App.tsx` - 应用根组件
- `src/renderer/pages/` - 页面组件
- `src/renderer/components/` - 可复用组件

### 3. 共享层 (Shared Layer)

**职责：**
- 类型定义
- 工具函数
- 常量配置
- 跨进程共享逻辑

**关键文件：**
- `src/shared/types.ts` - 所有数据类型定义
- `src/shared/constants.ts` - 分类规则、智能分配规则等
- `src/shared/drilldown.ts` - 钻取分析工具函数

### 4. 数据解析器 (Parsers)

**职责：**
- 不同来源账单格式解析
- 数据标准化
- 错误处理

**支持的格式：**
- Alipay CSV
- WeChat Pay CSV  
- Yunshanfu CSV
- Bank statements
- PDF bills
- HTML bills
- Image bills (OCR)

## 数据流

### 1. 导入流程
```
用户选择文件 → 渲染进程发送IPC → 主进程解析文件 → 
数据库存储 → 返回结果 → 渲染进程更新UI
```

### 2. 智能分配流程
```
新交易导入 → 应用分类规则 → 检查相似交易 → 
显示批量分配提示 → 用户确认 → 批量更新
```

### 3. 邮件自动捕获流程
```
定时同步 → IMAP连接 → 搜索账单邮件 → 
下载附件 → 自动导入 → 更新同步状态
```

### 4. 钻取分析流程
```
Dashboard点击 → 构建查询参数 → URL导航 → 
Transactions解析参数 → 应用过滤器 → 显示结果
```

## 数据库设计

使用 SQLite (通过 sql.js) 作为本地数据库，主要表结构：

### transactions 表
- 存储所有交易记录
- 支持多来源、多成员、多标签
- 包含去重和退款关联信息

### members 表  
- 家庭成员信息
- 用于交易分配

### budgets 表
- 预算配置
- 支持按月/分类预算

### assignment_patterns 表
- 智能分配学习模式
- 基于历史分配行为

### email_accounts/messages 表
- 邮件账户配置
- 邮件消息记录

## 安全考虑

- **本地优先**: 所有数据存储在本地，无云同步
- **密码安全**: 邮件账户密码加密存储
- **文件安全**: 临时文件自动清理
- **权限控制**: 最小权限原则

## 扩展性设计

- **插件式解析器**: 易于添加新的账单格式支持
- **模块化架构**: 功能模块解耦，便于维护
- **类型安全**: TypeScript 提供完整的类型检查
- **测试友好**: 核心逻辑可独立测试

## 性能优化

- **索引优化**: 数据库关键字段建立索引
- **懒加载**: 大数据量分页加载
- **缓存策略**: 频繁访问的数据缓存
- **异步处理**: 耗时操作异步执行

## 未来扩展方向

- **多货币支持**: 当前已预留 currency 字段
- **Web版本**: 渲染层可复用到 Web 应用
- **移动端**: 核心逻辑可移植到移动平台
- **AI增强**: 更智能的分类和分配算法