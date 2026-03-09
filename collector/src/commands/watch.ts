import chokidar from 'chokidar';
import { join, basename, dirname } from 'path';
import { mkdirSync, renameSync, existsSync } from 'fs';
import { getConfig } from '../config';

export function watchCommand(): void {
  const config = getConfig();

  // Ensure directories exist
  if (!existsSync(config.dropboxPath)) {
    mkdirSync(config.dropboxPath, { recursive: true });
    console.log(`📁 创建文件夹: ${config.dropboxPath}`);
  }

  if (!existsSync(config.archivePath)) {
    mkdirSync(config.archivePath, { recursive: true });
    console.log(`📁 创建文件夹: ${config.archivePath}`);
  }

  console.log('\n👀 正在监视文件夹:');
  console.log(`   ${config.dropboxPath}`);
  console.log(`\n   自动归档到:`);
  console.log(`   ${config.archivePath}\n`);

  const watcher = chokidar.watch(config.dropboxPath, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  watcher
    .on('add', (filePath) => {
      // Only process CSV, PDF, XLSX files
      const ext = filePath.toLowerCase();
      if (!ext.endsWith('.csv') && !ext.endsWith('.pdf') && !ext.endsWith('.xlsx')) {
        return;
      }

      const fileName = basename(filePath);
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Create archive subfolder for this month
      const archiveSubfolder = join(config.archivePath, yearMonth);
      if (!existsSync(archiveSubfolder)) {
        mkdirSync(archiveSubfolder, { recursive: true });
      }

      const destPath = join(archiveSubfolder, fileName);

      // Wait a moment to ensure file is fully written
      setTimeout(() => {
        try {
          renameSync(filePath, destPath);
          const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
          console.log(`[${timestamp}] 📥 已归档: ${fileName}`);
          console.log(`                    → archive/${yearMonth}/`);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] ❌ 归档失败: ${fileName}`);
        }
      }, 1000);
    })
    .on('error', (error) => {
      console.error('❌ 监视器错误:', error);
    });

  console.log('💡 提示: 将账单文件拖入文件夹即可自动归档\n');
  console.log('   按 Ctrl+C 停止监视\n');

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n👋 停止监视\n');
    watcher.close();
    process.exit(0);
  });
}
