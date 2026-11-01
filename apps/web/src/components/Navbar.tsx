import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Settings, Sun, Moon, Info, Sparkles } from 'lucide-react';
import { usePreferences } from '../hooks/usePreferences.js';

interface NavbarProps {
  onOpenAbout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAbout }) => {
  const location = useLocation();
  const { preferences, updatePreferences } = usePreferences();

  const toggleTheme = () => {
    if (preferences.theme === 'dark') {
      updatePreferences({ theme: 'light' });
    } else {
      updatePreferences({ theme: 'dark' });
    }
  };

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-100 dark:border-[#3c4043] bg-white/95 dark:bg-[#202124]/95 backdrop-blur-sm transition-colors">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Left: Brand */}
        <Link to="/" className="flex items-center gap-2 group text-decoration-none">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
            <Compass className="w-5 h-5" />
          </div>
          <span className="font-medium text-base tracking-tight text-gray-900 dark:text-gray-100 flex items-center gap-1">
            <span className="text-[#4285F4]">G</span>
            <span className="text-[#EA4335]">i</span>
            <span className="text-[#FBBC05]">t</span>
            <span className="text-[#4285F4]">H</span>
            <span className="text-[#34A853]">u</span>
            <span className="text-[#EA4335]">b</span>
            <span className="ml-1 text-gray-700 dark:text-gray-300 font-normal">Discovery</span>
          </span>
        </Link>

        {/* Right: Navigation items */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/explore"
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              isCurrent('/explore')
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Explore</span>
          </Link>

          {onOpenAbout && (
            <button
              onClick={onOpenAbout}
              className="px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-1.5"
            >
              <Info className="w-4 h-4" />
              <span>About</span>
            </button>
          )}

          <Link
            to="/settings"
            title="Settings & Status"
            className={`p-2 rounded-full transition-colors ${
              isCurrent('/settings')
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Settings className="w-4 h-4" />
          </Link>

          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {preferences.theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

