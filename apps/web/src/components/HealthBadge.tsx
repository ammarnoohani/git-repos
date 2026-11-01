import React from 'react';
import { DiscoveryHealth } from '@github-discovery/shared';
import { CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface HealthBadgeProps {
  health?: DiscoveryHealth;
  compact?: boolean;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ health, compact = false }) => {
  if (!health) {
    return null;
  }

  const { status, lastSuccessfulRun, message } = health;

  const getStatusConfig = () => {
    switch (status) {
      case 'healthy':
        return {
          label: 'Healthy',
          icon: CheckCircle2,
          color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800',
          dot: 'bg-emerald-500',
        };
      case 'delayed':
        return {
          label: 'Delayed',
          icon: Clock,
          color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
          dot: 'bg-amber-500',
        };
      case 'degraded':
        return {
          label: 'Degraded',
          icon: AlertTriangle,
          color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
          dot: 'bg-orange-500',
        };
      case 'failing':
      default:
        return {
          label: 'Failing',
          icon: XCircle,
          color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
          dot: 'bg-rose-500',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const timeAgo = lastSuccessfulRun ? formatTimeAgo(new Date(lastSuccessfulRun)) : 'Never';

  if (compact) {
    return (
      <span
        title={message || `Discovery: ${config.label}. Last run: ${timeAgo}`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span>{config.label}</span>
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>Discovery: <strong>{config.label}</strong></span>
      <span className="opacity-40">•</span>
      <span>Last sync: {timeAgo}</span>
    </div>
  );
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

