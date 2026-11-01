import fs from 'node:fs';
import path from 'node:path';
import {
  Repository,
  Manifest,
  Checkpoint,
  NotifiedState,
  RunStats,
  RepositorySchema,
  ManifestSchema,
  CheckpointSchema,
  NotifiedStateSchema,
  RunsListSchema,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_MAX_REPOS_PER_SHARD,
  SCHEMA_VERSION,
} from '@github-discovery/shared';
import { deduplicateRepositories } from '../merge/dedupe.js';

export interface StorageOptions {
  dataDir?: string;
  retentionDays?: number;
  maxReposPerShard?: number;
}

export class StorageManager {
  private dataDir: string;
  private reposDir: string;
  private stateDir: string;
  private retentionDays: number;
  private maxReposPerShard: number;

  constructor(options: StorageOptions = {}) {
    let targetDir = options.dataDir || process.env.DATA_DIR;
    if (!targetDir) {
      targetDir = fs.existsSync(path.resolve('../../package.json')) ? '../../data' : './data';
    } else if (!path.isAbsolute(targetDir) && fs.existsSync(path.resolve('../../package.json'))) {
      targetDir = path.resolve('../../', targetDir);
    }
    this.dataDir = path.resolve(targetDir);
    this.reposDir = path.join(this.dataDir, 'repos');
    this.stateDir = path.join(this.dataDir, 'state');
    this.retentionDays = options.retentionDays ?? (parseInt(process.env.RETENTION_DAYS || String(DEFAULT_RETENTION_DAYS), 10));
    this.maxReposPerShard = options.maxReposPerShard ?? (parseInt(process.env.MAX_REPOS_PER_SHARD || String(DEFAULT_MAX_REPOS_PER_SHARD), 10));

    this.ensureDirectories();
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.reposDir)) {
      fs.mkdirSync(this.reposDir, { recursive: true });
    }
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }

  /**
   * Performs an atomic write by saving to a temp file and renaming it.
   */
  public atomicWriteFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  }

  // --- Manifest Operations ---

  public getManifestPath(): string {
    return path.join(this.dataDir, 'manifest.json');
  }

  public loadManifest(): Manifest {
    const filePath = this.getManifestPath();
    if (!fs.existsSync(filePath)) {
      return {
        schemaVersion: SCHEMA_VERSION,
        lastUpdated: new Date().toISOString(),
        totalDiscovered: 0,
        shards: [],
        health: {
          status: 'healthy',
          lastSuccessfulRun: null,
          consecutiveFailures: 0,
          windowsPending: 0,
          truncatedWindows24h: 0,
          rateLimitStatus: null,
        },
        retentionSettings: {
          retentionDays: this.retentionDays,
          maxReposPerShard: this.maxReposPerShard,
        },
      };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return ManifestSchema.parse(parsed);
    } catch {
      // Return safe default if corrupted
      return {
        schemaVersion: SCHEMA_VERSION,
        lastUpdated: new Date().toISOString(),
        totalDiscovered: 0,
        shards: [],
        health: {
          status: 'degraded',
          lastSuccessfulRun: null,
          consecutiveFailures: 1,
          windowsPending: 0,
          truncatedWindows24h: 0,
          rateLimitStatus: null,
          message: 'Manifest file was corrupted, reset to defaults',
        },
        retentionSettings: {
          retentionDays: this.retentionDays,
          maxReposPerShard: this.maxReposPerShard,
        },
      };
    }
  }

  public saveManifest(manifest: Manifest): void {
    const validated = ManifestSchema.parse(manifest);
    const content = JSON.stringify(validated, null, 2);
    this.atomicWriteFile(this.getManifestPath(), content);
  }

  // --- Shard Operations ---

  public getShardPath(dateStr: string): string {
    // dateStr is YYYY-MM-DD
    return path.join(this.reposDir, `${dateStr}.json`);
  }

  public loadShard(dateStr: string): Repository[] {
    const filePath = this.getShardPath(dateStr);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.map((item) => RepositorySchema.parse(item));
    } catch {
      return [];
    }
  }

  public saveShard(dateStr: string, repositories: Repository[]): { count: number; bytes: number; truncated: boolean } {
    let list = deduplicateRepositories(repositories);
    let isTruncated = false;

    // Check capacity cap
    if (list.length > this.maxReposPerShard) {
      isTruncated = true;
      // Sort by score / stars descending, keep top maxReposPerShard
      list.sort((a, b) => (b.score || 0) - (a.score || 0) || b.stars - a.stars);
      list = list.slice(0, this.maxReposPerShard);
    }

    // Validate all items before writing
    list = list.map((r) => RepositorySchema.parse(r));

    const content = JSON.stringify(list); // minified JSON
    const filePath = this.getShardPath(dateStr);
    this.atomicWriteFile(filePath, content);

    const stats = fs.statSync(filePath);
    return {
      count: list.length,
      bytes: stats.size,
      truncated: isTruncated,
    };
  }

  /**
   * Ingests a batch of newly discovered repositories:
   * 1. Groups repos by UTC creation date (YYYY-MM-DD).
   * 2. Loads existing shard, merges & dedupes, saves shard.
   * 3. Prunes shards older than retentionDays.
   * 4. Updates manifest.json (cumulative totalDiscovered, shards list, lastUpdated).
   */
  public ingestRepositories(newRepos: Repository[]): { newDiscoveredCount: number; updatedCount: number } {
    if (newRepos.length === 0) {
      return { newDiscoveredCount: 0, updatedCount: 0 };
    }

    // Group incoming repos by creation day (UTC)
    const grouped = new Map<string, Repository[]>();
    for (const repo of newRepos) {
      const day = repo.createdAt ? repo.createdAt.substring(0, 10) : new Date().toISOString().substring(0, 10);
      const existing = grouped.get(day) || [];
      existing.push(repo);
      grouped.set(day, existing);
    }

    let newDiscoveredCount = 0;
    let updatedCount = 0;

    for (const [day, reposForDay] of grouped.entries()) {
      const existingShard = this.loadShard(day);
      const existingIdSet = new Set(existingShard.map((r) => r.id));

      for (const repo of reposForDay) {
        if (existingIdSet.has(repo.id)) {
          updatedCount++;
        } else {
          newDiscoveredCount++;
          existingIdSet.add(repo.id);
        }
      }

      const merged = deduplicateRepositories([...existingShard, ...reposForDay]);
      this.saveShard(day, merged);
    }

    // Retention pruning & manifest update
    this.pruneAndSyncManifest(newDiscoveredCount);

    return { newDiscoveredCount, updatedCount };
  }

  /**
   * Prunes shards older than retentionDays and syncs manifest shard list.
   */
  public pruneAndSyncManifest(newDiscoveredCount = 0): Manifest {
    const manifest = this.loadManifest();
    manifest.totalDiscovered += newDiscoveredCount;
    manifest.lastUpdated = new Date().toISOString();

    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - this.retentionDays);
    const cutoffStr = cutoffDate.toISOString().substring(0, 10);

    const shardFiles = fs.readdirSync(this.reposDir).filter((f) => f.endsWith('.json'));
    const validShards: Manifest['shards'] = [];

    for (const file of shardFiles) {
      const day = file.replace('.json', '');
      const filePath = path.join(this.reposDir, file);

      // Check retention
      if (day < cutoffStr) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // ignore
        }
        continue;
      }

      // Read shard stats
      try {
        const stats = fs.statSync(filePath);
        const repos = this.loadShard(day);
        validShards.push({
          date: day,
          path: `repos/${file}`,
          count: repos.length,
          bytes: stats.size,
          truncated: repos.length >= this.maxReposPerShard,
        });
      } catch {
        // ignore
      }
    }

    // Sort shards descending (newest first)
    validShards.sort((a, b) => b.date.localeCompare(a.date));
    manifest.shards = validShards;

    this.saveManifest(manifest);
    return manifest;
  }

  // --- Checkpoint Operations ---

  public getCheckpointPath(): string {
    return path.join(this.stateDir, 'checkpoint.json');
  }

  public loadCheckpoint(): Checkpoint {
    const filePath = this.getCheckpointPath();
    if (!fs.existsSync(filePath)) {
      return {
        lastCompletedWindowEnd: null,
        secondaryCursor: null,
        lastSuccessfulRun: null,
        status: 'idle',
        pendingWindows: [],
        truncatedWindows: [],
      };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return CheckpointSchema.parse(JSON.parse(raw));
    } catch {
      return {
        lastCompletedWindowEnd: null,
        secondaryCursor: null,
        lastSuccessfulRun: null,
        status: 'idle',
        pendingWindows: [],
        truncatedWindows: [],
      };
    }
  }

  public saveCheckpoint(checkpoint: Checkpoint): void {
    const validated = CheckpointSchema.parse(checkpoint);
    const content = JSON.stringify(validated, null, 2);
    this.atomicWriteFile(this.getCheckpointPath(), content);
  }

  // --- Notified Operations ---

  public getNotifiedPath(): string {
    return path.join(this.stateDir, 'notified.json');
  }

  public loadNotified(): NotifiedState {
    const filePath = this.getNotifiedPath();
    if (!fs.existsSync(filePath)) {
      return {
        schemaVersion: SCHEMA_VERSION,
        lastUpdated: new Date().toISOString(),
        channels: {
          telegram: { notifiedIds: {}, lastDigestAt: {} },
          email: { notifiedIds: {}, lastDigestAt: {} },
        },
      };
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return NotifiedStateSchema.parse(JSON.parse(raw));
    } catch {
      return {
        schemaVersion: SCHEMA_VERSION,
        lastUpdated: new Date().toISOString(),
        channels: {
          telegram: { notifiedIds: {}, lastDigestAt: {} },
          email: { notifiedIds: {}, lastDigestAt: {} },
        },
      };
    }
  }

  public saveNotified(notified: NotifiedState): void {
    notified.lastUpdated = new Date().toISOString();
    const validated = NotifiedStateSchema.parse(notified);
    const content = JSON.stringify(validated, null, 2);
    this.atomicWriteFile(this.getNotifiedPath(), content);
  }

  // --- Runs Operations ---

  public getRunsPath(): string {
    return path.join(this.stateDir, 'runs.json');
  }

  public loadRuns(): RunStats[] {
    const filePath = this.getRunsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return RunsListSchema.parse(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  public appendRun(run: RunStats): void {
    const runs = this.loadRuns();
    runs.unshift(run); // newest first
    const trimmed = runs.slice(0, 100); // keep last 100 runs
    const validated = RunsListSchema.parse(trimmed);
    const content = JSON.stringify(validated, null, 2);
    this.atomicWriteFile(this.getRunsPath(), content);
  }
}
