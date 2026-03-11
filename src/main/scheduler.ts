// Round 11: Smart Scheduler - Automated recurring task runner
import { getRecurringTransactions, generateRecurringTransactions } from './database';
import { scheduleAutoBackup } from './backup';

export interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  lastRun: string | null;
  nextRun: string;
  isEnabled: boolean;
}

export function startScheduler(): void {
  // Run every hour
  setInterval(() => {
    checkScheduledTasks();
  }, 60 * 60 * 1000);

  // Initial check
  checkScheduledTasks();
}

export function checkScheduledTasks(): void {
  const now = new Date();
  const hour = now.getHours();

  // Daily tasks at 6 AM
  if (hour === 6) {
    generateRecurringTransactions();
    scheduleAutoBackup();
  }

  // Hourly tasks
  // (placeholder for future hourly tasks)
}

export function getNextRunTime(cronExpression: string): Date {
  const now = new Date();
  // Simple implementation - add 1 hour
  return new Date(now.getTime() + 60 * 60 * 1000);
}
