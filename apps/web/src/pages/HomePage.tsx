import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, Sparkles, FolderGit2 } from 'lucide-react';
import { useManifest } from '../hooks/useData.js';
import { HealthBadge } from '../components/HealthBadge.js';

export const HomePage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { data: manifest, isLoading } = useManifest();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  const handleExplore = () => {
    navigate('/explore');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-20 max-w-3xl mx-auto w-full text-center animate-fade-in">
      {/* Google-inspired playful Logo */}
      <div className="mb-6 flex items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Compass className="w-8 h-8 animate-pulse" />
        </div>
      </div>

      <h1 className="text-3xl sm:text-5xl font-normal tracking-tight text-gray-900 dark:text-gray-100 mb-3">
        Discover What&apos;s New on GitHub.
      </h1>

      <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto mb-8 font-normal leading-relaxed">
        Explore newly created public repositories from developers around the world.
      </p>

      {/* Large Rounded Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-2xl mb-6">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-gray-400 dark:text-gray-500 pointer-events-none">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search discovered repositories by name, topic, or language..."
            className="w-full h-13 pl-12 pr-28 rounded-full border border-gray-200 dark:border-[#3c4043] bg-white dark:bg-[#303134] text-gray-900 dark:text-gray-100 shadow-sm hover:shadow-md focus:shadow-md focus:border-blue-500 dark:focus:border-blue-400 outline-none text-base transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-full transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
        <button
          onClick={handleExplore}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-[#303134] dark:hover:bg-[#3c4043] text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 border border-transparent dark:border-[#3c4043]"
        >
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span>Explore New Projects</span>
        </button>

        <button
          onClick={() => navigate('/explore?sort=stars')}
          className="px-5 py-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-[#202124] dark:hover:bg-[#303134] text-gray-600 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-200 dark:border-[#3c4043]"
        >
          Trending Stars
        </button>
      </div>

      {/* Discovery Metrics & Health */}
      <div className="w-full pt-8 border-t border-gray-100 dark:border-[#303134] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-blue-500" />
          <span>
            {isLoading ? (
              'Loading statistics...'
            ) : (
              <>
                <strong className="text-gray-900 dark:text-gray-200 font-semibold text-sm">
                  {(manifest?.totalDiscovered || 0).toLocaleString()}
                </strong>{' '}
                total repositories discovered
              </>
            )}
          </span>
        </div>

        <div>
          <HealthBadge health={manifest?.health} />
        </div>
      </div>
    </div>
  );
};

