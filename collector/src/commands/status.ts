import { getConfig } from '../config';
import { getLastImportBySource, closeDb } from '../db';

export function statusCommand(): number {
  const config = getConfig();
  const statuses = getLastImportBySource();
  closeDb();

  // Create a map of all sources with their status
  const sourceMap = new Map(
    Object.entries(config.sources).map(([id, source]) => [
      id,
      { ...source, id, lastDate: null as string | null, count: 0 },
    ])
  );

  // Fill in the data we found
  for (const status of statuses) {
    if (sourceMap.has(status.source)) {
      const source = sourceMap.get(status.source)!;
      source.lastDate = status.lastDate;
      source.count = status.count;
    }
  }

  console.log('\n📊 数据源收集状态\n');

  // Header
  console.log('来源'.padEnd(12) + '最后导入'.padEnd(14) + '状态'.padEnd(10) + '天数');
  console.log('─'.repeat(50));

  // Rows
  const now = new Date();
  let staleCount = 0;

  for (const [id, source] of sourceMap) {
    let statusStr: string;
    let daysStr: string;
    let statusColor: string;

    if (!source.lastDate) {
      statusStr = '🔴 缺失';
      daysStr = '-';
      statusColor = '\x1b[31m'; // Red
      staleCount++;
    } else {
      const lastDate = new Date(source.lastDate);
      const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 7) {
        statusStr = '✅ 新鲜';
        daysStr = daysDiff === 0 ? '今天' : `${daysDiff}天前`;
        statusColor = '\x1b[32m'; // Green
      } else if (daysDiff <= 30) {
        statusStr = '⚠️ 陈旧';
        daysStr = `${daysDiff}天前`;
        statusColor = '\x1b[33m'; // Yellow
        staleCount++;
      } else {
        statusStr = '🔴 缺失';
        daysStr = `${daysDiff}天前`;
        statusColor = '\x1b[31m'; // Red
        staleCount++;
      }
    }

    const resetColor = '\x1b[0m';
    console.log(
      `${source.name.padEnd(12)}${(source.lastDate || '从未导入').padEnd(14)}${statusColor}${statusStr.padEnd(10)}${resetColor}${daysStr}`
    );
  }

  console.log('');

  if (staleCount > 0) {
    console.log(`💡 提示: 运行 \x1b[36mcollector open <source>\x1b[0m 打开导出页面\n`);
    console.log(`   可用来源: ${Array.from(sourceMap.keys()).join(', ')}\n`);
  } else {
    console.log('✨ 所有数据源都是最新的！\n');
  }

  return staleCount > 0 ? 1 : 0;
}
