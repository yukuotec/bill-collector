# UX 优化计划

## 1. 交易记录页 (Transactions.tsx)

### 1.1 日期选择器优化
**当前问题**: 两个 date input，手动选择麻烦

**优化方案**:
```tsx
// 新增：智能日期选择组件
interface DateRange {
  label: string;
  startDate: string;
  endDate: string;
}

const PRESET_RANGES: DateRange[] = [
  { label: '今天', startDate: '2024-03-10', endDate: '2024-03-10' },
  { label: '昨天', startDate: '2024-03-09', endDate: '2024-03-09' },
  { label: '近7天', startDate: '2024-03-03', endDate: '2024-03-10' },
  { label: '近30天', startDate: '2024-02-10', endDate: '2024-03-10' },
  { label: '本周', startDate: '2024-03-04', endDate: '2024-03-10' },
  { label: '上周', startDate: '2024-02-26', endDate: '2024-03-03' },
  { label: '本月', startDate: '2024-03-01', endDate: '2024-03-10' },
  { label: '上月', startDate: '2024-02-01', endDate: '2024-02-29' },
  { label: '今年', startDate: '2024-01-01', endDate: '2024-03-10' },
  { label: '去年', startDate: '2023-01-01', endDate: '2023-12-31' },
  { label: '自定义', startDate: '', endDate: '' },
];
```

**UI设计**:
- 下拉选择预设时间段（今天/昨天/近7天/近30天/本周/上周/本月/上月/今年/去年/自定义）
- 选择"自定义"时才显示日期输入框
- 显示当前选择的时间范围标签（可点击修改）

### 1.2 搜索后统计面板
**当前问题**: 只显示总条数，无金额统计

**优化方案**:
在表格上方添加统计卡片：
```tsx
interface SearchStats {
  totalCount: number;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  avgAmount: number;
}
```

**UI设计**:
```
┌─────────────────────────────────────────────────────────┐
│  📊 搜索结果统计                                          │
├──────────────┬──────────────┬──────────────┬────────────┤
│  共 156 条    │  收入 +¥8,520 │  支出 -¥12,340│  结余 -¥3,820│
└──────────────┴──────────────┴──────────────┴────────────┘
```

### 1.3 重复记录批量处理
**当前问题**: 单条处理，无批量选择

**优化方案**:
```tsx
// 批量操作状态
const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
const [batchAction, setBatchAction] = useState<'keep' | 'merge' | null>(null);

// 批量处理函数
const handleBatchDuplicateAction = async (action: 'keep' | 'merge') => {
  for (const id of selectedDuplicates) {
    await window.electronAPI.resolveDuplicate(id, action);
  }
  // 刷新列表
};
```

**UI设计**:
- 重复记录表格添加复选框
- 顶部添加批量操作栏：
  - "保留选中 (5)" 按钮
  - "合并选中 (5)" 按钮
  - "全选/取消全选"

### 1.4 合并字段对比选择
**当前问题**: 直接合并，不显示差异字段

**优化方案**:
创建对比选择弹窗：
```tsx
interface DuplicateCompareDialogProps {
  duplicate: DuplicateReviewItem;
  target: Transaction;
  onResolve: (action: 'keep' | 'merge', fieldChoices?: Record<string, 'current' | 'target'>) => void;
}
```

**UI设计**:
```
┌────────────────────────────────────────────────────────────┐
│  🔍 重复记录对比                                            │
├──────────────────────┬─────────────────────────────────────┤
│  当前记录            │  建议保留记录                        │
├──────────────────────┼─────────────────────────────────────┤
│  📅 2024-03-10       │  📅 2024-03-10       [✓ 使用此项]    │
│  🏪 麦当劳           │  🏪 麦当劳肯德基     [○ 使用此项]    │
│  📝 午餐             │  📝 午餐消费         [○ 使用此项]    │
│  💰 ¥45.00           │  💰 ¥45.00           [✓ 使用此项]    │
├──────────────────────┴─────────────────────────────────────┤
│  [保留两条]  [按选择合并]  [智能合并(默认)]                  │
└────────────────────────────────────────────────────────────┘
```

---

## 2. 导入页 (Import.tsx)

### 2.1 日期选择优化
**当前问题**: 导入后日期范围需手动设置

**优化方案**:
- 自动检测账单日期范围
- 提供"仅导入本月/上月/自定义日期"选项
- 显示日期分布预览（日历热力图）

### 2.2 导入统计增强
**当前问题**: 仅显示总条数

**优化方案**:
```tsx
interface ImportStats {
  totalCount: number;
  bySource: Record<string, number>;
  byMonth: Record<string, number>;
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpense: number;
}
```

---

## 3. 仪表盘页 (Dashboard.tsx)

### 3.1 快速操作优化
**当前问题**: 查看全部、导入按钮分散

**优化方案**:
- 添加"快速筛选"快捷入口：
  - "查看本月支出"
  - "查看未分类交易"
  - "查看重复记录"
  - "查看退款记录"

### 3.2 数据完整性提示
**当前问题**: 用户不知哪些数据源缺失

**优化方案**:
- 在仪表盘显示"数据完整度"卡片
- 点击跳转到 Source Coverage 页面
- 显示"近7天无数据"的预警

---

## 4. 快速记账页 (QuickAdd.tsx)

### 4.1 智能填充优化
**当前问题**: 自动完成不够智能

**优化方案**:
- 根据商家自动填充分类
- 根据时间自动推荐成员（基于历史模式）
- 支持模板快速记账（常用交易一键添加）

### 4.2 批量快速记账
**当前问题**: 只能单条添加

**优化方案**:
- 支持表格批量输入
- 类似 Excel 的行内编辑体验

---

## 5. 预算页 (Budgets.tsx)

### 5.1 预算使用率可视化
**当前问题**: 仅显示进度条

**优化方案**:
- 添加"预计超支"预警
- 显示"日均可用额度"
- 对比上月同期使用趋势

---

## 6. 全局优化

### 6.1 快捷键支持
```
Ctrl/Cmd + N: 快速记账
Ctrl/Cmd + F: 聚焦搜索
Ctrl/Cmd + I: 打开导入
Ctrl/Cmd + D: 打开仪表盘
Esc: 关闭弹窗/取消编辑
```

### 6.2 加载状态优化
- 骨架屏替代 loading 文字
- 操作按钮添加 loading 状态
- 批量操作显示进度条

### 6.3 空状态优化
- 每个页面添加友好的空状态插图
- 提供"去导入"、"去添加"等快捷引导

---

## 优先级排序

| 优先级 | 功能 | 影响 | 工作量 |
|--------|------|------|--------|
| P0 | 日期选择器优化 | 高 | 小 |
| P0 | 搜索统计面板 | 高 | 小 |
| P1 | 重复记录批量处理 | 高 | 中 |
| P1 | 合并字段对比 | 中 | 中 |
| P2 | 快捷键支持 | 中 | 小 |
| P2 | 导入统计增强 | 低 | 小 |
| P3 | 批量快速记账 | 低 | 大 |
