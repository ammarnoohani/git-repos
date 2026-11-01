import {
  DiscoveryHealth,
  Manifest,
  Checkpoint,
  RateLimitStatus,
  HEALTH_DELAYED_MINUTES,
  HEALTH_FAILING_MINUTES,
  HEALTH_MAX_CONSECUTIVE_FAILURES,
} from '@github-discovery/shared';

export function calculateDiscoveryHealth(
  manifest: Manifest,
  checkpoint: Checkpoint,
  rateLimit: RateLimitStatus | null = null,
  lastDurationSeconds?: number,
  now: Date = new Date()
): DiscoveryHealth {
  const lastSuccessIso = checkpoint.lastSuccessfulRun || manifest.health.lastSuccessfulRun;
  const consecutiveFailures = checkpoint.status === 'failed' ? manifest.health.consecutiveFailures + 1 : 0;
  const windowsPending = (checkpoint.pendingWindows || []).length;

  // Count truncated windows in the last 24 hours
  const past24hMs = now.getTime() - 24 * 60 * 60 * 1000;
  const truncated24h = (checkpoint.truncatedWindows || []).filter((tw) => {
    const t = new Date(tw.recordedAt).getTime();
    return t >= past24hMs;
  }).length;

  let minutesSinceLastSuccess = Infinity;
  if (lastSuccessIso) {
    minutesSinceLastSuccess = (now.getTime() - new Date(lastSuccessIso).getTime()) / (60 * 1000);
  }

  let status: DiscoveryHealth['status'] = 'healthy';
  let message: string | undefined;

  if (consecutiveFailures >= HEALTH_MAX_CONSECUTIVE_FAILURES || minutesSinceLastSuccess >= HEALTH_FAILING_MINUTES) {
    status = 'failing';
    message = consecutiveFailures >= HEALTH_MAX_CONSECUTIVE_FAILURES
      ? `${consecutiveFailures} consecutive runs failed`
      : `No successful run in ${Math.round(minutesSinceLastSuccess)} minutes`;
  } else if (minutesSinceLastSuccess >= HEALTH_DELAYED_MINUTES) {
    status = 'delayed';
    message = `Last successful discovery was ${Math.round(minutesSinceLastSuccess)} minutes ago`;
  } else if (windowsPending > 0 || truncated24h > 0) {
    status = 'degraded';
    message = windowsPending > 0 ? `${windowsPending} pending windows to retry` : `${truncated24h} truncated windows in last 24h`;
  } else {
    status = 'healthy';
    message = 'Discovery pipeline running normally';
  }

  return {
    status,
    lastSuccessfulRun: lastSuccessIso,
    consecutiveFailures,
    windowsPending,
    truncatedWindows24h: truncated24h,
    rateLimitStatus: rateLimit,
    lastRunDurationSeconds: lastDurationSeconds,
    message,
  };
}
