import React from 'react';
import { X, ShieldCheck, Zap, Database } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#202124] border border-gray-200 dark:border-[#3c4043] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Zap className="w-4 h-4" />
          </div>
          <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100">About GitHub Discovery</h2>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          GitHub Discovery is a continuous, autonomous feed of freshly created open-source repositories from developers worldwide. Built with a <strong>$0 hosting target</strong>.
        </p>

        <div className="my-5 space-y-3">
          <div className="p-3 bg-gray-50 dark:bg-[#303134] rounded-xl flex items-start gap-3">
            <Database className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-0.5">
                Database-Free Architecture
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                Instead of expensive databases, discovered repositories are partitioned into daily JSON shards committed to a dedicated <code>data</code> branch.
              </span>
            </div>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-[#303134] rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold text-gray-900 dark:text-gray-100 block mb-0.5">
                Zero Client Credentials
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                The frontend never makes calls to GitHub APIs and requires no tokens. It only reads public static JSON files from the data branch.
              </span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
          <strong>Honesty Notice:</strong> Discovery runs as a background GitHub Action every ~10–15 minutes. Due to GitHub Search indexing lag, rate limits, and scheduled action queues, discovery is best-effort and will not capture every repository ever created.
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
