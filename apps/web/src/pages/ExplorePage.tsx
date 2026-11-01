import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  ArrowUpDown,
  RotateCcw,
  AlertCircle,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { SortOption, RepositoryFilters } from '@github-discovery/shared';
import { useManifest, useLoadedShards } from '../hooks/useData.js';
import { usePreferences } from '../hooks/usePreferences.js';
import { RepoCard } from '../components/RepoCard.js';
import { filterAndSortRepositories } from '../utils/filterRepos.js';

export const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences } = usePreferences();
  const { data: manifest, isLoading: isManifestLoading, error: manifestError } = useManifest();

  const {
    allRepositories,
    loadedShardPaths,
    isLoadingShard,
    hasMoreShards,
    loadNextShard,
    shardError,
  } = useLoadedShards(manifest);

  // URL search state
  const initialQuery = searchParams.get('q') || '';
  const initialSort = (searchParams.get('sort') as SortOption) || preferences.defaultSort || 'newest';

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [showFilters, setShowFilters] = useState(false);

  // Filters state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [minStars, setMinStars] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [includeArchived, setIncludeArchived] = useState<boolean>(true);
  const [includeForks, setIncludeForks] = useState<boolean>(false);

  // Pagination inside loaded records
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = preferences.pageSize || 25;

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Sync with searchParams
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set('q', debouncedQuery);
    if (sort !== 'newest') params.set('sort', sort);
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, sort, setSearchParams]);

  // Extract unique languages from loaded records
  const availableLanguages = useMemo(() => {
    const set = new Set<string>();
    for (const repo of allRepositories) {
      if (repo.language) set.add(repo.language);
    }
    return Array.from(set).sort();
  }, [allRepositories]);

  // Apply filters and sort
  const filteredRepositories = useMemo(() => {
    const filters: RepositoryFilters = {
      query: debouncedQuery,
      language: selectedLanguage,
      minStars,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      includeArchived,
      includeForks,
    };
    return filterAndSortRepositories(allRepositories, filters, sort);
  }, [allRepositories, debouncedQuery, selectedLanguage, minStars, startDate, endDate, includeArchived, includeForks, sort]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredRepositories.length / pageSize));
  const paginatedRepos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRepositories.slice(start, start + pageSize);
  }, [filteredRepositories, currentPage, pageSize]);

  const handleResetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setSelectedLanguage('all');
    setMinStars(0);
    setStartDate('');
    setEndDate('');
    setIncludeArchived(true);
    setIncludeForks(false);
    setSort('newest');
    setCurrentPage(1);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 w-full">
      {/* Header & Search */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900 dark:text-gray-100 mb-2">
          Explore Discovered Repositories
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          Displaying newly created public GitHub repositories discovered in the retained 14-day window. Search runs client-side over loaded day shards.
        </p>

        {/* Search Input Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, description, owner, or topics..."
              className="w-full h-11 pl-9 pr-4 rounded-lg border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] text-gray-900 dark:text-gray-100 text-sm focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`h-11 px-3.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400'
                : 'border-gray-200 dark:border-[#3c4043] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#303134]'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </button>

          {/* Sort Selector */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="h-11 pl-3 pr-8 rounded-lg border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] text-gray-700 dark:text-gray-300 text-sm font-medium focus:border-blue-500 outline-none appearance-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="stars">Most Starred</option>
              <option value="updated">Recently Updated</option>
              <option value="oldest">Oldest First</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="mt-3 p-4 bg-gray-50 dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-xl text-xs space-y-3 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none"
                >
                  <option value="all">All Languages</option>
                  {availableLanguages.map((lang) => (
                    <option key={lang} value={lang.toLowerCase()}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Stars
                </label>
                <input
                  type="number"
                  min="0"
                  value={minStars}
                  onChange={(e) => setMinStars(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full h-8 px-2 rounded border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date Range
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-1/2 h-8 px-1.5 rounded border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none text-[11px]"
                  />
                  <span className="text-gray-400">-</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-1/2 h-8 px-1.5 rounded border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-gray-200 dark:border-[#3c4043] gap-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={includeForks}
                    onChange={(e) => setIncludeForks(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Include Forks</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Include Archived</span>
                </label>
              </div>

              <button
                onClick={handleResetFilters}
                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="py-2.5 mb-4 flex flex-wrap items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#303134]">
        <span>
          Showing <strong>{filteredRepositories.length.toLocaleString()}</strong> of{' '}
          {allRepositories.length.toLocaleString()} loaded across{' '}
          <strong>{loadedShardPaths.length}</strong> day shards
        </span>

        {manifest && (
          <span className="text-[11px]">
            Total discovered: {(manifest.totalDiscovered || 0).toLocaleString()}
          </span>
        )}
      </div>

      {/* Shard or Manifest Errors */}
      {(manifestError || shardError) && (
        <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="block font-semibold">Unable to fetch discovery data</strong>
            <span>{manifestError?.message || shardError}</span>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              Check your <code>VITE_DATA_BASE_URL</code> or ensure the <code>data</code> branch has been published.
            </p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isManifestLoading && (
        <div className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">
          Loading discovery manifest...
        </div>
      )}

      {/* Empty State */}
      {!isManifestLoading && filteredRepositories.length === 0 && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          <Layers className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-base font-medium text-gray-700 dark:text-gray-300 mb-1">
            No repositories found
          </h3>
          <p className="text-xs max-w-sm mx-auto mb-4">
            {allRepositories.length === 0
              ? 'No day shards have been ingested yet. Run the discovery job to fetch recent public repositories.'
              : 'Try relaxing your search terms or filters to see more results.'}
          </p>
          {allRepositories.length > 0 && (
            <button
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 bg-gray-100 dark:bg-gray-800 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* List of Repositories */}
      <div className="divide-y divide-gray-100 dark:divide-[#303134]">
        {paginatedRepos.map((repo) => (
          <RepoCard key={repo.id} repo={repo} />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-[#303134] flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#3c4043] disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#303134]"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#3c4043] disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-[#303134]"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Lazy Shard Loader (Load More Days) */}
      {hasMoreShards && (
        <div className="mt-8 text-center">
          <button
            onClick={loadNextShard}
            disabled={isLoadingShard}
            className="px-5 py-2.5 rounded-full border border-gray-300 dark:border-[#3c4043] text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#303134] disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            <ChevronDown className="w-3.5 h-3.5" />
            <span>{isLoadingShard ? 'Loading previous day shard...' : 'Load older day shard'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
