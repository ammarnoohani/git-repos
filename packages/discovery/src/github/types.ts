export interface GitHubSearchItem {
  id: number;
  node_id?: string;
  name: string;
  full_name: string;
  private?: boolean;
  owner: {
    login: string;
    id?: number;
    avatar_url: string;
    html_url: string;
    type?: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  url?: string;
  created_at: string;
  updated_at: string;
  pushed_at?: string | null;
  homepage?: string | null;
  size?: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
  visibility?: string;
  topics?: string[];
  license?: {
    key: string;
    name: string;
    spdx_id: string | null;
    url: string | null;
  } | null;
  archived?: boolean;
  disabled?: boolean;
  is_template?: boolean;
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchItem[];
}

export interface GitHubPublicRepoItem {
  id: number;
  node_id?: string;
  name: string;
  full_name: string;
  private?: boolean;
  owner: {
    login: string;
    id?: number;
    avatar_url: string;
    html_url: string;
    type?: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  url?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}
