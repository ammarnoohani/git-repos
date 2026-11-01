import React from 'react';
import {
  Sliders,
  Activity,
  Bell,
} from 'lucide-react';
import { SortOption } from '@github-discovery/shared';
import { usePreferences } from '../hooks/usePreferences.js';
import { useManifest } from '../hooks/useData.js';
import { HealthBadge } from '../components/HealthBadge.js';

export const SettingsPage: React.FC = () => {
  const { preferences, updatePreferences } = usePreferences();
  const { data: manifest, refetch, isRefetching } = useManifest();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 w-full space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Settings & Diagnostics
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Zero-cost, static hosting architecture: user preferences are stored in your local browser, while worker status is read from the published data branch.
        </p>
      </div>

      {/* Section 1: Local Browser Preferences */}
      <div className="p-5 bg-white dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100 dark:border-[#3c4043]">
          <Sliders className="w-4 h-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Local Preferences (Browser Storage)
          </h2>
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-800 dark:text-gray-200 block">Theme</label>
              <span className="text-gray-500 dark:text-gray-400">Choose your interface display mode</span>
            </div>
            <select
              value={preferences.theme}
              onChange={(e) => updatePreferences({ theme: e.target.value as 'light' | 'dark' | 'system' })}
              className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-[#3c4043] bg-gray-50 dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-800 dark:text-gray-200 block">Default Sort Order</label>
              <span className="text-gray-500 dark:text-gray-400">Preferred sorting when opening Explore</span>
            </div>
            <select
              value={preferences.defaultSort}
              onChange={(e) => updatePreferences({ defaultSort: e.target.value as SortOption })}
              className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-[#3c4043] bg-gray-50 dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="stars">Most Starred</option>
              <option value="updated">Recently Updated</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-800 dark:text-gray-200 block">Page Size</label>
              <span className="text-gray-500 dark:text-gray-400">Repositories displayed per page in Explore</span>
            </div>
            <select
              value={preferences.pageSize}
              onChange={(e) => updatePreferences({ pageSize: parseInt(e.target.value, 10) })}
              className="h-8 px-2.5 rounded-lg border border-gray-200 dark:border-[#3c4043] bg-gray-50 dark:bg-[#202124] text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="15">15 items</option>
              <option value="25">25 items</option>
              <option value="50">50 items</option>
              <option value="100">100 items</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Discovery Pipeline Diagnostics */}
      <div className="p-5 bg-white dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-[#3c4043]">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Discovery Engine Diagnostics
            </h2>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50"
          >
            {isRefetching ? 'Refreshing...' : 'Refresh Manifest'}
          </button>
        </div>

        {manifest ? (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#3c4043]">
              <span className="text-gray-500 dark:text-gray-400">Current Health Status</span>
              <HealthBadge health={manifest.health} compact />
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#3c4043]">
              <span className="text-gray-500 dark:text-gray-400">Last Successful Sync</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">
                {manifest.health.lastSuccessfulRun
                  ? new Date(manifest.health.lastSuccessfulRun).toLocaleString()
                  : 'Never'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#3c4043]">
              <span className="text-gray-500 dark:text-gray-400">Consecutive Failures</span>
              <span className={`font-mono ${manifest.health.consecutiveFailures > 0 ? 'text-rose-500 font-semibold' : 'text-gray-800 dark:text-gray-200'}`}>
                {manifest.health.consecutiveFailures}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#3c4043]">
              <span className="text-gray-500 dark:text-gray-400">Pending Windows to Retry</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">
                {manifest.health.windowsPending}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#3c4043]">
              <span className="text-gray-500 dark:text-gray-400">Truncated Windows (24h)</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">
                {manifest.health.truncatedWindows24h}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-[#3c4043]">
              <span className="text-gray-500 dark:text-gray-400">Data Retention Window</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">
                {manifest.retentionSettings.retentionDays} days (max {manifest.retentionSettings.maxReposPerShard.toLocaleString()} repos/shard)
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-gray-500 dark:text-gray-400">Schema Version</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">
                v{manifest.schemaVersion}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400">No manifest data available.</div>
        )}
      </div>

      {/* Section 3: Notification Setup Guide */}
      <div className="p-5 bg-white dark:bg-[#303134] border border-gray-200 dark:border-[#3c4043] rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100 dark:border-[#3c4043]">
          <Bell className="w-4 h-4 text-purple-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Notification Setup Guide (GitHub Secrets)
          </h2>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
          <p>
            Because this frontend has no backend server or database, notifications are triggered directly from your repository&apos;s GitHub Actions workflow using encrypted GitHub Secrets.
          </p>

          <div className="bg-gray-50 dark:bg-[#202124] p-3.5 rounded-xl border border-gray-200 dark:border-[#3c4043] space-y-2 font-mono text-[11px]">
            <div className="text-gray-500 font-sans font-semibold text-xs">Available Secrets to Add:</div>
            <div><span className="text-blue-500 font-semibold">TELEGRAM_BOT_TOKEN</span>: Bot token from @BotFather</div>
            <div><span className="text-blue-500 font-semibold">TELEGRAM_CHAT_ID</span>: Target chat or channel ID</div>
            <div><span className="text-purple-500 font-semibold">RESEND_API_KEY</span>: Resend API key (re_...) for email dispatch</div>
            <div><span className="text-purple-500 font-semibold">NOTIFY_EMAIL</span>: Destination email address</div>
            <div><span className="text-emerald-500 font-semibold">GH_API_TOKEN</span>: (Optional) Fine-grained token for 5,000 req/hr</div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-blue-900 dark:text-blue-300">
            <strong className="block mb-1 font-semibold">How to test your notifications:</strong>
            Go to your GitHub repository &rarr; <strong>Actions</strong> tab &rarr; select <strong>Discover Repositories</strong> workflow &rarr; click <strong>Run workflow</strong> and check the <code>test_notification</code> checkbox!
          </div>
        </div>
      </div>
    </div>
  );
};
