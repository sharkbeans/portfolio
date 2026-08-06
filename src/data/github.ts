import raw from "./generated/github.json";

export type GithubDay = { date: string; count: number };
export type GithubWeek = { days: GithubDay[] };

export type GithubLanguage = {
  name: string;
  color: string | null;
  size: number;
};

export type GithubRepo = {
  name: string;
  url: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  languageColor: string | null;
  isArchived: boolean;
  isPrivate: boolean;
  pushedAt: string;
};

export type GithubCommitClock = {
  sampled: number;
  reposScanned: number;
  hours: number[];
  weekdays: number[];
} | null;

export type GithubStats = {
  generatedAt: string | null;
  login: string;
  profile: {
    name: string | null;
    createdAt: string;
    followers: number;
    publicRepos: number;
    privateRepoCount: number;
  };
  contributions: {
    total: number;
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
    private: number;
    weeks: GithubWeek[];
  };
  languages: GithubLanguage[];
  repos: GithubRepo[];
  commitClock: GithubCommitClock;
};

export const githubStats = raw as GithubStats;

/** True once scripts/fetch-github-stats.mjs has run with a real token. */
export const isLiveGithubData = githubStats.generatedAt !== null;

export function flattenDays(weeks: GithubWeek[]): GithubDay[] {
  return weeks.flatMap((week) => week.days);
}

/** Heatmap fill level 0-4, quartile-bucketed against the year's busiest day. */
export function levelFor(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio > 0.75) return 4;
  if (ratio > 0.5) return 3;
  if (ratio > 0.25) return 2;
  return 1;
}

export type Streaks = { current: number; longest: number };

/** Both streaks in one pass over the flattened, date-ascending day list. */
export function computeStreaks(days: GithubDay[]): Streaks {
  let longest = 0;
  let running = 0;
  let current = 0;

  for (let i = 0; i < days.length; i += 1) {
    if (days[i].count > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }

  // Current streak: walk back from the last day; a still-open "today" with
  // zero contributions doesn't break a streak that ended yesterday.
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const isToday = i === days.length - 1;
    if (days[i].count > 0) {
      current += 1;
    } else if (isToday) {
      continue;
    } else {
      break;
    }
  }

  return { current, longest };
}
