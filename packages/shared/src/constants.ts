export const SCHEMA_VERSION = '1.0.0';

export const DEFAULT_RETENTION_DAYS = 14;
export const DEFAULT_MAX_REPOS_PER_SHARD = 5000;
export const DEFAULT_SEARCH_LAG_MINUTES = 3;
export const DEFAULT_OVERLAP_MINUTES = 10;
export const DEFAULT_RUN_TIME_BUDGET_SECONDS = 480;
export const DEFAULT_MAX_REQUESTS_PER_RUN = 50;
export const DEFAULT_NOTIFY_MAX_PER_RUN = 10;
export const DEFAULT_ENRICH_PER_RUN = 10;
export const DEFAULT_DIGEST_FREQUENCY = 'daily'; // 'hourly' | '6hourly' | 'daily'
export const DEFAULT_QUERY_FILTERS = 'fork:false';

// Thresholds for discovery health
export const HEALTH_DELAYED_MINUTES = 30;
export const HEALTH_FAILING_MINUTES = 90;
export const HEALTH_MAX_CONSECUTIVE_FAILURES = 3;
