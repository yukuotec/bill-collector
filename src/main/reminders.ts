import { BrowserWindow, Notification, ipcMain } from 'electron';
import { getBudgets, getBudgetSpending, getActiveRecurringTransactions, getRecurringTransactions, generateRecurringTransactions } from './database';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface ReminderConfig {
  budgetAlerts: boolean;
  budgetThreshold: number;
  recurringReminders: boolean;
  importReminders: boolean;
  importReminderDay: number;
}

interface ReminderRule {
  id: string;
  type: 'budget' | 'recurring' | 'import';
  title: string;
  message: string;
  check: () => Promise<boolean>;
  lastChecked?: Date;
}

let reminderInterval: NodeJS.Timeout | null = null;
let mainWindow: BrowserWindow | null = null;
let currentConfig: ReminderConfig;

const defaultConfig: ReminderConfig = {
  budgetAlerts: true,
  budgetThreshold: 80,
  recurringReminders: true,
  importReminders: true,
  importReminderDay: 5,
};

function getConfigPath(): string {
  const configDir = path.join(os.homedir(), 'Library/Application Support/expense-tracker');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return path.join(configDir, 'reminder-config.json');
}

function getConfig(): ReminderConfig {
  if (currentConfig) return currentConfig;
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const saved = fs.readFileSync(configPath, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(saved) };
    }
  } catch (error) {
    console.error('[Reminders] Failed to load config:', error);
  }
  return defaultConfig;
}

function saveConfig(config: ReminderConfig): boolean {
  try {
    const configPath = getConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    currentConfig = config;
    return true;
  } catch (error) {
    console.error('[Reminders] Failed to save config:', error);
    return false;
  }
}

function sendNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: './assets/icon.png',
    }).show();
  }

  // Also send to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('reminder-notification', { title, body });
  }
}

async function checkBudgetAlerts(): Promise<boolean> {
  const config = getConfig();
  if (!config.budgetAlerts) return false;

  try {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const budgets = getBudgets().filter(b => b.year_month === yearMonth);

    let alerted = false;
    for (const budget of budgets) {
      const spending = getBudgetSpending(budget.id, yearMonth);
      const percentage = budget.amount > 0 ? (spending / budget.amount) * 100 : 0;

      if (percentage >= 100) {
        sendNotification(
          '预算超支提醒',
          `${budget.category || '总预算'}已超支！已使用 ¥${spending.toFixed(2)} / ¥${budget.amount.toFixed(2)}`
        );
        alerted = true;
      } else if (percentage >= config.budgetThreshold) {
        sendNotification(
          '预算预警',
          `${budget.category || '总预算'}已使用 ${percentage.toFixed(0)}%，接近预算上限`
        );
        alerted = true;
      }
    }
    return alerted;
  } catch (error) {
    console.error('[Reminders] Budget check failed:', error);
    return false;
  }
}

async function checkRecurringReminders(): Promise<boolean> {
  const config = getConfig();
  if (!config.recurringReminders) return false;

  try {
    // Check for recurring transactions that should be generated
    const recurring = getActiveRecurringTransactions();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    let reminded = false;
    for (const item of recurring) {
      // Check if transaction needs to be generated
      if (item.frequency === 'monthly' && item.day_of_month) {
        if (now.getDate() === item.day_of_month) {
          sendNotification(
            '周期记账提醒',
            `今天需要记录: ${item.name} ¥${item.amount.toFixed(2)}`
          );
          reminded = true;
        }
      }
    }

    // Auto-generate recurring transactions
    const generated = generateRecurringTransactions();
    if (generated > 0) {
      sendNotification(
        '周期记账已生成',
        `已自动生成 ${generated} 条周期记账记录`
      );
      reminded = true;
    }

    return reminded;
  } catch (error) {
    console.error('[Reminders] Recurring check failed:', error);
    return false;
  }
}

async function checkImportReminders(): Promise<boolean> {
  const config = getConfig();
  if (!config.importReminders) return false;

  try {
    const now = new Date();
    // Remind on configured day of month
    if (now.getDate() === config.importReminderDay) {
      sendNotification(
        '数据导入提醒',
        `本月${config.importReminderDay}号了，记得导入各平台账单数据`
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Reminders] Import check failed:', error);
    return false;
  }
}

const reminderRules: ReminderRule[] = [
  {
    id: 'budget-alert',
    type: 'budget',
    title: '预算提醒',
    message: '检查预算使用情况',
    check: checkBudgetAlerts,
  },
  {
    id: 'recurring-reminder',
    type: 'recurring',
    title: '周期记账提醒',
    message: '检查周期记账项目',
    check: checkRecurringReminders,
  },
  {
    id: 'import-reminder',
    type: 'import',
    title: '数据导入提醒',
    message: '提醒导入账单数据',
    check: checkImportReminders,
  },
];

async function runReminderChecks() {
  console.log('[Reminders] Running scheduled checks...');
  for (const rule of reminderRules) {
    try {
      const triggered = await rule.check();
      if (triggered) {
        rule.lastChecked = new Date();
      }
    } catch (error) {
      console.error(`[Reminders] Rule ${rule.id} failed:`, error);
    }
  }
}

export function initializeReminders(window: BrowserWindow) {
  mainWindow = window;

  // Load config at startup
  currentConfig = getConfig();

  // Register IPC handlers
  ipcMain.handle('get-reminder-config', () => {
    return getConfig();
  });

  ipcMain.handle('set-reminder-config', (_, config: Partial<ReminderConfig>) => {
    try {
      const current = getConfig();
      const updated = { ...current, ...config };
      return saveConfig(updated);
    } catch (error) {
      console.error('[Reminders] Failed to save config:', error);
      return false;
    }
  });

  ipcMain.handle('test-reminder', (_, type: string) => {
    switch (type) {
      case 'budget':
        sendNotification('预算提醒测试', '这是一条预算提醒测试消息');
        return true;
      case 'recurring':
        sendNotification('周期记账提醒测试', '这是一条周期记账提醒测试消息');
        return true;
      case 'import':
        sendNotification('数据导入提醒测试', '这是一条数据导入提醒测试消息');
        return true;
      default:
        return false;
    }
  });

  // Run initial check
  runReminderChecks();

  // Schedule periodic checks (every hour)
  reminderInterval = setInterval(runReminderChecks, 60 * 60 * 1000);

  console.log('[Reminders] System initialized');
}

export function stopReminders() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  mainWindow = null;
  console.log('[Reminders] System stopped');
}
