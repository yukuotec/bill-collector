import open from 'open';
import { getConfig } from '../config';

export async function openCommand(sourceId: string): Promise<void> {
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

  if (!source.exportUrl || !source.autoOpen) {
    console.log(`\n📱 ${source.name}\n`);
    console.log('该来源需要在应用内操作，无法自动打开网页。\n');
    console.log('导出步骤:');
    source.exportGuide.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    console.log('');
    return;
  }

  console.log(`\n🌐 正在打开 ${source.name} 导出页面...`);
  console.log(`   ${source.exportUrl}\n`);

  try {
    await open(source.exportUrl);
    console.log('✅ 已打开浏览器\n');
  } catch (error) {
    console.error('❌ 打开浏览器失败:', error);
    console.log(`   请手动访问: ${source.exportUrl}\n`);
  }
}
