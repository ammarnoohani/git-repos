import {
  Manifest,
  Repository,
  ManifestSchema,
  RepositorySchema,
} from '@github-discovery/shared';

const RAW_BASE_URL = import.meta.env.VITE_DATA_BASE_URL || '/data';
export const DATA_BASE_URL = RAW_BASE_URL.replace(/\/$/, '');

export async function fetchManifest(): Promise<Manifest> {
  const url = `${DATA_BASE_URL}/manifest.json?t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest (${response.status}): ${response.statusText}`);
  }

  const json = await response.json();
  const parsed = ManifestSchema.safeParse(json);
  if (!parsed.success) {
    console.error('Manifest validation errors:', parsed.error);
    throw new Error('Manifest file format is invalid or from an incompatible schema version.');
  }

  return parsed.data;
}

export async function fetchShard(shardPath: string): Promise<Repository[]> {
  const cleanPath = shardPath.startsWith('/') ? shardPath.slice(1) : shardPath;
  const url = `${DATA_BASE_URL}/${cleanPath}?t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load shard at ${cleanPath} (${response.status})`);
  }

  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error(`Shard at ${cleanPath} is not an array`);
  }

  // Parse items safely, filtering out corrupted items rather than failing completely
  const validRepos: Repository[] = [];
  for (const item of json) {
    const res = RepositorySchema.safeParse(item);
    if (res.success) {
      validRepos.push(res.data);
    }
  }

  return validRepos;
}

