/**
 * Data source definitions for collection tracking
 * Sources are data feeds (export files), not financial accounts
 */

export type SourceType = 'auto' | 'semi-auto' | 'manual';

export interface SourceConfig {
  id: SourceId;
  name: string;
  icon: string;
  type: SourceType;
  description: string;
}

export type SourceId = 'alipay' | 'wechat' | 'yunshanfu' | 'bank' | 'manual';

export const SOURCES: SourceConfig[] = [
  {
    id: 'alipay',
    name: '支付宝账单',
    icon: 'alipay',
    type: 'semi-auto',
    description: '从支付宝网页版导出账单 CSV'
  },
  {
    id: 'wechat',
    name: '微信账单',
    icon: 'wechat',
    type: 'semi-auto',
    description: '从微信钱包导出账单'
  },
  {
    id: 'yunshanfu',
    name: '云闪付账单',
    icon: 'card',
    type: 'semi-auto',
    description: '从云闪付 APP 导出账单'
  },
  {
    id: 'bank',
    name: '银行账单',
    icon: 'bank',
    type: 'semi-auto',
    description: '银行网银导出的账单 CSV/PDF'
  },
  {
    id: 'manual',
    name: '手工录入',
    icon: 'edit',
    type: 'manual',
    description: '现金等零星支出手动记录'
  }
];

export function getSourceById(id: SourceId): SourceConfig | undefined {
  return SOURCES.find(s => s.id === id);
}

export function getSourceName(id: SourceId): string {
  return getSourceById(id)?.name || id;
}
