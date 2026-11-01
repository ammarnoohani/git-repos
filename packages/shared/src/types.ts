import { z } from 'zod';
import {
  RepositorySchema,
  RepoOwnerSchema,
  RepoLicenseSchema,
  ShardItemSchema,
  DiscoveryHealthSchema,
  RateLimitStatusSchema,
  ManifestSchema,
  PendingWindowSchema,
  TruncatedWindowSchema,
  CheckpointSchema,
  NotifiedStateSchema,
  RunStatsSchema,
} from './schemas.js';

export type RepoOwner = z.infer<typeof RepoOwnerSchema>;
export type RepoLicense = z.infer<typeof RepoLicenseSchema>;
export type Repository = z.infer<typeof RepositorySchema>;
export type ShardItem = z.infer<typeof ShardItemSchema>;
export type DiscoveryHealth = z.infer<typeof DiscoveryHealthSchema>;
export type RateLimitStatus = z.infer<typeof RateLimitStatusSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;
export type PendingWindow = z.infer<typeof PendingWindowSchema>;
export type TruncatedWindow = z.infer<typeof TruncatedWindowSchema>;
export type Checkpoint = z.infer<typeof CheckpointSchema>;
export type NotifiedState = z.infer<typeof NotifiedStateSchema>;
export type RunStats = z.infer<typeof RunStatsSchema>;

export type SortOption = 'newest' | 'oldest' | 'stars' | 'updated';

export interface RepositoryFilters {
  query?: string;
  language?: string;
  minStars?: number;
  startDate?: string;
  endDate?: string;
  includeArchived?: boolean;
  includeForks?: boolean;
}
