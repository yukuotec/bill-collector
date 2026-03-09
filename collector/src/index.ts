#!/usr/bin/env node

import { Command } from 'commander';
import { statusCommand } from './commands/status';
import { openCommand } from './commands/open';
import { guideCommand } from './commands/guide';
import { remindCommand } from './commands/remind';
import { watchCommand } from './commands/watch';

const program = new Command();

program
  .name('collector')
  .description('CLI tool to streamline expense data collection')
  .version('1.0.0');

program
  .command('status')
  .description('Show freshness status for all sources')
  .action(() => {
    const exitCode = statusCommand();
    process.exit(exitCode);
  });

program
  .command('open')
  .description('Open export page for a source')
  .argument('<source>', 'Source name (alipay, wechat, yunshanfu, bank, manual)')
  .action(async (source: string) => {
    await openCommand(source);
  });

program
  .command('guide')
  .description('Show export instructions for a source')
  .argument('<source>', 'Source name (alipay, wechat, yunshanfu, bank, manual)')
  .action((source: string) => {
    guideCommand(source);
  });

program
  .command('remind')
  .description('Check if any sources are stale (for cron)')
  .action(() => {
    const exitCode = remindCommand();
    process.exit(exitCode);
  });

program
  .command('watch')
  .description('Watch dropbox folder and auto-archive imports')
  .action(() => {
    watchCommand();
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

program.parse();
