import { Repository } from './types.js';

/**
 * Calculates a quality/notability score for a repository.
 * Higher score indicates a more notable or well-formed project.
 * Used to rank notifications (top N per run) and digest summaries.
 */
export function calculateRepoScore(repo: Partial<Repository>): number {
  let score = 0;

  const stars = repo.stars || 0;
  const forks = repo.forks || 0;
  score += stars * 5;
  score += forks * 3;

  if (repo.description && repo.description.trim().length > 0) {
    score += 3;
    if (repo.description.trim().length >= 40) {
      score += 2;
    }
  }

  if (repo.topics && repo.topics.length > 0) {
    score += Math.min(repo.topics.length * 2, 8);
  }

  if (repo.license && repo.license.key && repo.license.key !== 'other') {
    score += 2;
  }

  if (repo.language) {
    score += 1;
  }

  if (repo.archived) {
    score -= 5;
  }

  if (repo.fork) {
    score -= 5;
  }

  return score;
}

