import React from 'react';
import { ExternalLink, Database } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-gray-100 dark:border-[#3c4043] py-6 px-4 bg-gray-50/50 dark:bg-[#1f2023] text-xs text-gray-500 dark:text-gray-400 mt-auto transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <p className="font-medium text-gray-700 dark:text-gray-300 flex items-center justify-center sm:justify-start gap-1.5">
            <Database className="w-3.5 h-3.5 text-blue-500" />
            <span>100% Database-Free & Zero-Cost Architecture</span>
          </p>
          <p className="mt-0.5 text-gray-500 dark:text-gray-400">
            Discovery is best-effort, updates every ~10–15 minutes, and retains the last 14 days of public repositories.
          </p>
        </div>

        <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-800 dark:hover:text-gray-200 transition-colors inline-flex items-center gap-1"
          >
            <span>Powered by GitHub REST API</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </footer>
  );
};
