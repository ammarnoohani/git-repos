import { Repository, SortOption, RepositoryFilters } from '@github-discovery/shared';

export function filterAndSortRepositories(
  repositories: Repository[],
  filters: RepositoryFilters,
  sort: SortOption = 'newest'
): Repository[] {
  const query = (filters.query || '').trim().toLowerCase();
  const lang = (filters.language || '').trim().toLowerCase();
  const minStars = filters.minStars ?? 0;
  const startDate = filters.startDate;
  const endDate = filters.endDate;
  const includeArchived = filters.includeArchived ?? true;
  const includeForks = filters.includeForks ?? true;

  const filtered = repositories.filter((repo) => {
    // 1. Text Search Query
    if (query) {
      const matchName = repo.name.toLowerCase().includes(query);
      const matchFullName = repo.fullName.toLowerCase().includes(query);
      const matchDesc = repo.description ? repo.description.toLowerCase().includes(query) : false;
      const matchOwner = repo.owner.login.toLowerCase().includes(query);
      const matchLang = repo.language ? repo.language.toLowerCase().includes(query) : false;
      const matchTopics = repo.topics.some((t) => t.toLowerCase().includes(query));

      if (!matchName && !matchFullName && !matchDesc && !matchOwner && !matchLang && !matchTopics) {
        return false;
      }
    }

    // 2. Language filter
    if (lang && lang !== 'all') {
      if (!repo.language || repo.language.toLowerCase() !== lang) {
        return false;
      }
    }

    // 3. Stars filter
    if (minStars > 0 && repo.stars < minStars) {
      return false;
    }

    // 4. Forks filter
    if (!includeForks && repo.fork) {
      return false;
    }

    // 5. Archived filter
    if (!includeArchived && repo.archived) {
      return false;
    }

    // 6. Date Range filter (created_at YYYY-MM-DD)
    const repoDay = repo.createdAt.substring(0, 10);
    if (startDate && repoDay < startDate) {
      return false;
    }
    if (endDate && repoDay > endDate) {
      return false;
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return a.createdAt.localeCompare(b.createdAt);
      case 'stars':
        return b.stars - a.stars || (b.score || 0) - (a.score || 0);
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt);
      case 'newest':
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });

  return filtered;
}
