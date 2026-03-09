import { getConfig } from '../config';

export function guideCommand(sourceId: string): void {
  const config = getConfig();
  const source = config.sources[sourceId];

  if (!source) {
    console.error(`\n❌ 未知的数据源: ${sourceId}`);
    console.log(`\n可用来源:`);
    Object.entries(config.sources).forEach(([id, s]) => {
      console.log(`  - ${id}: ${s.name}`);
    });
    console.log('');
    process.exit(1);
  }

  console.log(`\n📱 ${source.name} 导出步骤\n`);

  if (source.exportUrl) {
    console.log(`网页地址: ${source.exportUrl}\n`);
  }

  source.exportGuide.forEach((step, i) => {
    console.log(`${i + 1}. ${step}`);
  });

  console.log('');

  if (source.exportUrl) {
    console.log(`💡 提示: 运行 \x1b[36mcollector open ${sourceId}\x1b[0m 快速打开网页\n`);
  }
}
