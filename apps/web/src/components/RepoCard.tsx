import React from 'react';
import { Link } from 'react-router-dom';
import { Repository } from '@github-discovery/shared';
import { Star, GitFork, ExternalLink, Calendar, Clock } from 'lucide-react';

interface RepoCardProps {
  repo: Repository;
}

export const RepoCard: React.FC<RepoCardProps> = ({ repo }) => {
  const createdDate = repo.createdAt.substring(0, 10);
  const discoveredAgo = formatShortTimeAgo(new Date(repo.discoveredAt));

  return (
    <article className="py-4 border-b border-gray-100 dark:border-[#303134] hover:bg-gray-50/60 dark:hover:bg-[#28292c] px-3 -mx-3 rounded-lg transition-colors group">
      {/* Breadcrumb / Owner line */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
        <img
          src={repo.owner.avatarUrl}
          alt={repo.owner.login}
          className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700 object-cover"
          loading="lazy"
        />
        <span>{repo.owner.login}</span>
        <span>/</span>
        <span className="text-gray-400 dark:text-gray-500 font-mono text-[11px]">#{repo.id}</span>
      </div>

      {/* Main Title */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-normal tracking-tight leading-snug">
          <Link
            to={`/repo/${repo.id}`}
            className="text-[#1a0dab] dark:text-[#8ab4f8] hover:underline font-medium visited:text-[#681da8] dark:visited:text-[#c58af9]"
          >
            {repo.name}
          </Link>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-2">
            ({repo.fullName})
          </span>
        </h3>

        <a
          href={repo.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Open repository on GitHub"
          className="text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 p-1 opacity-70 group-hover:opacity-100 transition-opacity"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Short Description */}
      <p className="mt-1 text-sm text-[#4d5156] dark:text-[#bdc1c6] leading-relaxed line-clamp-2 font-normal">
        {repo.description || <span className="italic text-gray-400 dark:text-gray-500">No description provided</span>}
      </p>

      {/* Topics */}
      {repo.topics && repo.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {repo.topics.slice(0, 5).map((topic) => (
            <span
              key={topic}
              className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40"
            >
              #{topic}
            </span>
          ))}
          {repo.topics.length > 5 && (
            <span className="text-[11px] text-gray-400 self-center">
              +{repo.topics.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Metadata Bar */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
        {repo.language && (
          <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>{repo.language}</span>
          </span>
        )}

        <span className="flex items-center gap-1" title="Stars">
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span>{repo.stars.toLocaleString()}</span>
        </span>

        {repo.forks > 0 && (
          <span className="flex items-center gap-1" title="Forks">
            <GitFork className="w-3 h-3" />
            <span>{repo.forks.toLocaleString()}</span>
          </span>
        )}

        <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500" title="Created date">
          <Calendar className="w-3 h-3" />
          <span>Created {createdDate}</span>
        </span>

        <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500" title="Discovered date">
          <Clock className="w-3 h-3" />
          <span>Found {discoveredAgo}</span>
        </span>

        {repo.license && (
          <span className="text-gray-400 dark:text-gray-500 text-[11px] border border-gray-200 dark:border-gray-700 px-1.5 py-0.2 rounded">
            {repo.license.spdxId || repo.license.name}
          </span>
        )}
      </div>
    </article>
  );
};

function formatShortTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
