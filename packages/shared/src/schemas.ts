import { z } from 'zod';

export const RepoOwnerSchema = z.object({
  login: z.string(),
  id: z.number().optional(),
  avatarUrl: z.string(),
  htmlUrl: z.string(),
  type: z.string().optional(),
});

export const RepoLicenseSchema = z.object({
  key: z.string(),
  name: z.string(),
  spdxId: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
});

export const RepositorySchema = z.object({
  id: z.number(),
  nodeId: z.string().optional(),
  name: z.string(),
  fullName: z.string(),
  description: z.string().nullable().optional(),
  owner: RepoOwnerSchema,
  htmlUrl: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pushedAt: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  stars: z.number().default(0),
  forks: z.number().default(0),
  watchers: z.number().default(0),
  openIssues: z.number().default(0),
  defaultBranch: z.string().default('main'),
  visibility: z.string().default('public'),
  license: RepoLicenseSchema.nullable().optional(),
  topics: z.array(z.string()).default([]),
  archived: z.boolean().default(false),
  fork: z.boolean().default(false),
  isTemplate: z.boolean().optional(),
  discoveredAt: z.string(),
  lastSyncedAt: z.string(),
  score: z.number().optional(),
  discoveryMethod: z.enum(['search', 'public_repos', 'enriched']).optional(),
});

export const ShardItemSchema = z.object({
  date: z.string(), // YYYY-MM-DD
  path: z.string(), // repos/YYYY-MM-DD.json
  count: z.number(),
  bytes: z.number(),
  truncated: z.boolean().optional(),
});

export const RateLimitStatusSchema = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number(),
  used: z.number(),
});

export const DiscoveryHealthSchema = z.object({
  status: z.enum(['healthy', 'delayed', 'failing', 'degraded']),
  lastSuccessfulRun: z.string().nullable(),
  consecutiveFailures: z.number(),
  windowsPending: z.number(),
  truncatedWindows24h: z.number(),
  rateLimitStatus: RateLimitStatusSchema.nullable().optional(),
  lastRunDurationSeconds: z.number().optional(),
  message: z.string().optional(),
});

export const ManifestSchema = z.object({
  schemaVersion: z.string(),
  lastUpdated: z.string(),
  totalDiscovered: z.number(),
  shards: z.array(ShardItemSchema),
  health: DiscoveryHealthSchema,
  retentionSettings: z.object({
    retentionDays: z.number(),
    maxReposPerShard: z.number(),
  }),
});

export const PendingWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  retries: z.number(),
  error: z.string().optional(),
});

export const TruncatedWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  count: z.number(),
  recordedAt: z.string(),
});

export const CheckpointSchema = z.object({
  lastCompletedWindowEnd: z.string().nullable(),
  secondaryCursor: z.number().nullable().optional(),
  lastSuccessfulRun: z.string().nullable(),
  status: z.enum(['idle', 'running', 'completed', 'failed']),
  pendingWindows: z.array(PendingWindowSchema).default([]),
  truncatedWindows: z.array(TruncatedWindowSchema).optional().default([]),
});

export const ChannelNotifiedSchema = z.object({
  notifiedIds: z.record(z.string(), z.string()).default({}), // repoId -> ISO timestamp
  lastDigestAt: z.record(z.string(), z.string()).optional().default({}), // frequency -> ISO timestamp
});

export const NotifiedStateSchema = z.object({
  schemaVersion: z.string(),
  lastUpdated: z.string(),
  channels: z.object({
    telegram: ChannelNotifiedSchema.optional(),
    email: ChannelNotifiedSchema.optional(),
  }),
});

export const RunStatsSchema = z.object({
  runId: z.string(),
  timestamp: z.string(),
  durationSeconds: z.number(),
  method: z.enum(['search', 'public_repos', 'hybrid', 'test']),
  discoveredCount: z.number(),
  newCount: z.number(),
  updatedCount: z.number(),
  windowsProcessed: z.number(),
  windowsTruncated: z.number(),
  windowsFailed: z.number(),
  rateLimitRemaining: z.number().nullable().optional(),
  notifiedCount: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const RunsListSchema = z.array(RunStatsSchema);
