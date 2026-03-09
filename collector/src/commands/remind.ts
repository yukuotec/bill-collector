import { getConfig } from '../config';
import { getLastImportBySource, closeDb } from '../db';

export function remindCommand(): void {
  const config = getConfig();
  const statuses = getLastImportBySource();
  closeDb();

  // Create a map of all sources
  const sourceMap = new Map(
    Object.entries(config.sources).map(([id, source]) => [
      id,
      { ...source, id, lastDate: null as string | null },
    ])
  );

  // Fill in the data
  for (const status of statuses) {
    if (sourceMap.has(status.source)) {
      const source = sourceMap.get(status.source)!;
      source.lastDate = status.lastDate;
    }
  }

  // Find stale sources
  const now = new Date();
  const staleSources: { name: string; days: number }[] = [];

  for (const [id, source] of sourceMap) {
    if (!source.lastDate) {
      staleSources.push({ name: source.name, days: Infinity });
    } else {
      const lastDate = new Date(source.lastDate);
      const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff > config.remindThresholdDays) {
        staleSources.push({ name: source.name, days: daysDiff });
      }
    }
  }

  if (staleSources.length === 0) {
    console.log('');
    process.exit(0);
  }

  console.log('\n⚠️ 需要关注的数据源:\n');

  for (const source of staleSources) {
    if (source.days === Infinity) {
      console.log(`   - ${source.name}: 从未导入`);
    } else {
      console.log(`   - ${source.name}: ${source.days}天未更新`);
    }
  }

  console.log('');
  console.log(`💡 运行 \x1b[36mcollector status\x1b[0m 查看完整状态\n`);

  process.exit(1);
}
