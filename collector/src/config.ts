import { homedir } from 'os';
import { join } from 'path';

export interface CollectorConfig {
  dropboxPath: string;
  archivePath: string;
  dbPath: string;
  sources: Record<string, SourceConfig>;
  remindThresholdDays: number;
}

export interface SourceConfig {
  name: string;
  exportUrl?: string;
  exportGuide: string[];
  autoOpen: boolean;
}

// Default configuration
export const defaultConfig: CollectorConfig = {
  dropboxPath: join(homedir(), 'expense-dropbox'),
  archivePath: join(homedir(), 'expense-dropbox', 'archive'),
  dbPath: join(
    homedir(),
    'Library',
    'Application Support',
    'expense-tracker',
    'expenses.db'
  ),
  sources: {
    alipay: {
      name: '支付宝账单',
      exportUrl: 'https://consumeprod.alipay.com/record/standard.htm',
      exportGuide: [
        '访问支付宝网页版 (https://www.alipay.com)',
        '登录后点击 "交易记录"',
        '选择时间范围（建议选整月）',
        '点击 "下载查询结果"',
        '将 CSV 文件保存到 dropbox 文件夹',
      ],
      autoOpen: true,
    },
    wechat: {
      name: '微信账单',
      exportUrl: 'https://pay.weixin.qq.com/index.php/public/auth_login',
      exportGuide: [
        '打开微信 → 我 → 服务 → 钱包',
        '点击右上角 "账单"',
        '点击右上角 "常见问题"',
        '选择 "下载账单"',
        '选择 "用于个人对账"',
        '选择时间范围（建议选整月）',
        '输入邮箱地址',
        '收到邮件后下载解压',
        '将 CSV 文件保存到 dropbox 文件夹',
      ],
      autoOpen: true,
    },
    yunshanfu: {
      name: '云闪付账单',
      exportGuide: [
        '打开云闪付 APP',
        '点击底部 "我的"',
        '点击 "账单"',
        '点击右上角 "..."',
        '选择 "导出账单"',
        '选择时间范围并导出',
        '将 CSV 文件保存到 dropbox 文件夹',
      ],
      autoOpen: false,
    },
    bank: {
      name: '银行账单',
      exportGuide: [
        '登录银行网银或手机银行',
        '进入 "账户管理" 或 "交易明细"',
        '选择要导出的账户',
        '选择时间范围（建议选整月）',
        '点击 "导出" 或 "下载"',
        '选择 CSV 格式',
        '将文件保存到 dropbox 文件夹',
      ],
      autoOpen: false,
    },
    manual: {
      name: '手工录入',
      exportGuide: [
        '打开记账小助手应用',
        '点击 "快速记账"',
        '手动添加现金或其他未记录的交易',
      ],
      autoOpen: false,
    },
  },
  remindThresholdDays: 7,
};

// Get config (in future could read from file)
export function getConfig(): CollectorConfig {
  return defaultConfig;
}
