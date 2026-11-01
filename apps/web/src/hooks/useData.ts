import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Manifest, Repository } from '@github-discovery/shared';
import { fetchManifest, fetchShard } from '../services/api.js';

export function useManifest() {
  return useQuery<Manifest, Error>({
    queryKey: ['manifest'],
    queryFn: fetchManifest,
    staleTime: 60 * 1000, // 1 minute
    retry: 2,
  });
}

export function useLoadedShards(manifest?: Manifest) {
  const [loadedShardPaths, setLoadedShardPaths] = useState<string[]>([]);
  const [repositoriesMap, setRepositoriesMap] = useState<Map<number, Repository>>(new Map());
  const [isLoadingShard, setIsLoadingShard] = useState(false);
  const [shardError, setShardError] = useState<string | null>(null);

  const availableShards = useMemo(() => {
    return manifest?.shards || [];
  }, [manifest]);

  // Load the first (newest) shard when manifest is ready
  useEffect(() => {
    if (availableShards.length > 0 && loadedShardPaths.length === 0 && !isLoadingShard) {
      const first = availableShards[0];
      setIsLoadingShard(true);
      fetchShard(first.path)
        .then((repos) => {
          setRepositoriesMap((prev) => {
            const next = new Map(prev);
            for (const r of repos) next.set(r.id, r);
            return next;
          });
          setLoadedShardPaths([first.path]);
          setShardError(null);
        })
        .catch((err) => {
          setShardError(err.message || 'Failed to load initial shard');
        })
        .finally(() => {
          setIsLoadingShard(false);
        });
    }
  }, [availableShards, loadedShardPaths.length, isLoadingShard]);

  const loadNextShard = useCallback(async () => {
    if (isLoadingShard) return;
    const nextShard = availableShards.find((s) => !loadedShardPaths.includes(s.path));
    if (!nextShard) return;

    setIsLoadingShard(true);
    try {
      const repos = await fetchShard(nextShard.path);
      setRepositoriesMap((prev) => {
        const next = new Map(prev);
        for (const r of repos) next.set(r.id, r);
        return next;
      });
      setLoadedShardPaths((prev) => [...prev, nextShard.path]);
      setShardError(null);
    } catch (err: unknown) {
      setShardError((err as Error).message || 'Failed to load shard');
    } finally {
      setIsLoadingShard(false);
    }
  }, [availableShards, loadedShardPaths, isLoadingShard]);

  const hasMoreShards = loadedShardPaths.length < availableShards.length;

  const allRepositories = useMemo(() => {
    return Array.from(repositoriesMap.values());
  }, [repositoriesMap]);

  return {
    allRepositories,
    loadedShardPaths,
    isLoadingShard,
    hasMoreShards,
    loadNextShard,
    shardError,
  };
}
