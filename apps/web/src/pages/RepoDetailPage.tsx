import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Star,
  GitFork,
  Eye,
  AlertCircle,
  Calendar,
  Clock,
  Shield,
  Code,
  Tag,
  GitBranch,
} from 'lucide-react';
import { useManifest, useLoadedShards } from '../hooks/useData.js';

export const RepoDetailPage: React.FC = () => {
  const { githubId } = useParams<{ githubId: string }>();
  const idNum = parseInt(githubId || '0', 10);

  const { data: manifest, isLoading: isManifestLoading } = useManifest();
  const { allRepositories, hasMoreShards, loadNextShard, isLoadingShard } = useLoadedShards(manifest);

  const repo = useMemo(() => {
    return allRepositories.find((r) => r.id === idNum);
  }, [allRepositories, idNum]);

  if (isManifestLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm text-gray-500">
        Loading repository details...
      </div>
    );
  }

  if (!repo) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center animate-fade-in">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
          Repository Not Found in Active Window
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
          This repository may have been pruned due to the 14-day retention window, or it might be in an older day shard that has not been loaded into the browser yet.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {hasMoreShards && (
            <button
              onClick={loadNextShard}
              disabled={isLoadingShard}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {isLoadingShard ? 'Scanning older shards...' : 'Search in older shards'}
            </button>
          )}

          <a
            href={`https://github.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors inline-flex items-center gap-1.5"
          >
            <span>Open GitHub Directly</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <Link
            to="/explore"
            className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  const createdDate = new Date(repo.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const updatedDate = new Date(repo.updatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const discoveredDate = new Date(repo.discoveredAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full animate-fade-in">
      <Link
        to="/explore"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Explore</span>
      </Link>

      {/* Main Header */}
      <div className="p-6 bg-white dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-2xl shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-[#3c4043]">
          <div className="flex items-center gap-3">
            <img
              src={repo.owner.avatarUrl}
              alt={repo.owner.login}
              className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-700 object-cover"
            />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {repo.owner.login}
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {repo.name}
              </h1>
            </div>
          </div>

          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 shadow-sm"
          >
            <span>View on GitHub</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Description */}
        <p className="mt-4 text-base text-gray-700 dark:text-gray-300 leading-relaxed">
          {repo.description || <span className="italic text-gray-400">No description provided.</span>}
        </p>

        {/* Topics */}
        {repo.topics && repo.topics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {repo.topics.map((topic) => (
              <span
                key={topic}
                className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40 inline-flex items-center gap-1"
              >
                <Tag className="w-3 h-3" />
                <span>{topic}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Metrics & Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 bg-gray-50 dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-xl text-center">
          <Star className="w-4 h-4 text-amber-500 mx-auto mb-1 fill-amber-500" />
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {repo.stars.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Stars</div>
        </div>

        <div className="p-3.5 bg-gray-50 dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-xl text-center">
          <GitFork className="w-4 h-4 text-blue-500 mx-auto mb-1" />
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {repo.forks.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Forks</div>
        </div>

        <div className="p-3.5 bg-gray-50 dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-xl text-center">
          <Eye className="w-4 h-4 text-purple-500 mx-auto mb-1" />
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {repo.watchers.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Watchers</div>
        </div>

        <div className="p-3.5 bg-gray-50 dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-xl text-center">
          <Code className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
          <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
            {repo.language || 'Plain text'}
          </div>
          <div className="text-[11px] text-gray-500 dark:text-gray-400">Language</div>
        </div>
      </div>

      {/* Additional Details List */}
      <div className="p-5 bg-white dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-2xl text-xs space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 pb-2 border-b border-gray-100 dark:border-[#3c4043]">
          Discovery & Repository Details
        </h3>

        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-[#3c4043]">
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Created on GitHub
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{createdDate}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-[#3c4043]">
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Discovered By Pipeline
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{discoveredDate}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-[#3c4043]">
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Last Updated
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{updatedDate}</span>
        </div>

        <div className="flex items-center justify-between py-1 border-b border-gray-50 dark:border-[#3c4043]">
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> License
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {repo.license ? `${repo.license.name} (${repo.license.spdxId || 'Custom'})` : 'None specified'}
          </span>
        </div>

        <div className="flex items-center justify-between py-1">
          <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" /> Default Branch
          </span>
          <span className="font-mono text-gray-700 dark:text-gray-300">{repo.defaultBranch}</span>
        </div>
      </div>
    </div>
  );
};

