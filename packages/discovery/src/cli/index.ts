import 'dotenv/config';
import { DiscoveryEngine } from '../engine.js';
import { DigestManager } from '../notify/digest.js';
import { StorageManager } from '../storage/manager.js';
import { NotificationDispatcher } from '../notify/dispatcher.js';

async function main() {
  const args = process.argv.slice(2);
  let mode = 'discover';
  let forceFullScan = false;
  let testNotification = false;

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      mode = arg.split('=')[1];
    } else if (arg === '--force-full-scan' || arg === '--force_full_scan=true') {
      forceFullScan = true;
    } else if (arg === '--test-notification' || arg === '--test_notification=true') {
      testNotification = true;
    }
  }

  // Handle environment variables passed from GitHub Actions workflow_dispatch
  if (process.env.FORCE_FULL_SCAN === 'true') {
    forceFullScan = true;
  }
  if (process.env.TEST_NOTIFICATION === 'true') {
    testNotification = true;
  }

  const storage = new StorageManager();

  if (testNotification || mode === 'test-notify') {
    console.log(JSON.stringify({ level: 'info', action: 'test_notification_start' }));
    const dispatcher = new NotificationDispatcher(storage);
    const success = await dispatcher.runTestNotification();
    console.log(JSON.stringify({ level: 'info', action: 'test_notification_complete', success }));
    process.exit(success ? 0 : 1);
  }

  if (mode === 'digest') {
    console.log(JSON.stringify({ level: 'info', action: 'digest_start' }));
    const digestMgr = new DigestManager(storage);
    const result = await digestMgr.runDigest();
    console.log(JSON.stringify({ level: 'info', action: 'digest_complete', result }));
    process.exit(0);
  }

  // Default: Run Discovery Cycle
  try {
    const engine = new DiscoveryEngine({ storage });
    const stats = await engine.runDiscoveryCycle({ forceFullScan });
    console.log(JSON.stringify({ level: 'info', action: 'discover_finished', success: stats.success }));
    process.exit(0);
  } catch (err: unknown) {
    console.error(JSON.stringify({
      level: 'error',
      action: 'discover_fatal',
      error: (err as Error).message || String(err),
      stack: (err as Error).stack,
    }));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error in CLI:', err);
  process.exit(1);
});
