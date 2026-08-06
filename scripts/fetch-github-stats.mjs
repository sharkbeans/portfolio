#!/usr/bin/env node
/**
 * Fetches public GitHub activity for the profile in src/data/profile.ts and
 * writes it to src/data/generated/github.json, which the /stats page renders
 * at build time. Nothing here runs in the browser — the token stays in CI.
 *
 * The contribution calendar (the commit graph) is only exposed through the
 * GraphQL API, and GraphQL always requires auth, hence the token requirement.
 *
 * Optionally set GH_STATS_PRIVATE_TOKEN (a fine-grained PAT scoped to "All
 * repositories", Contents: Read-only) to auto-discover every private repo on
 * the account and fold their language bytes and commit timestamps into the
 * aggregates — anonymously, by default: name, description, URL, and star
 * count are read but not written out. Set GH_STATS_SHOWCASE_REPOS
 * ("owner/name,owner/name") to explicitly opt specific private repos into
 * being named and linked in the Top Repositories list too.
 *
 * Run: GITHUB_TOKEN=<token> node scripts/fetch-github-stats.mjs
 * Output: src/data/generated/github.json
 *
 * Exits 0 and leaves the existing JSON untouched if the token is missing or
 * the API errors, so a credential problem degrades the page instead of
 * breaking the deploy.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outFile = join(__dirname, "..", "src", "data", "generated", "github.json");

const LOGIN = process.env.GITHUB_STATS_LOGIN ?? "sharkbeans";
const TOKEN = process.env.GH_STATS_TOKEN ?? process.env.GITHUB_TOKEN;

/**
 * Optional, separate credential for folding every private repo's language
 * bytes and commit timestamps into the aggregates ONLY — repo name,
 * description, URL, and star count never leave this script. Deliberately a
 * second token rather than widening GH_STATS_TOKEN: GH_STATS_TOKEN stays
 * read:user-only (no repo content access at all), and this one is a
 * fine-grained PAT with read-only Contents access — so a leak of either
 * token exposes as little as possible. It needs "All repositories" access
 * (rather than hand-picked repos) so newly created private repos are picked
 * up automatically without a config change.
 */
const PRIVATE_TOKEN = process.env.GH_STATS_PRIVATE_TOKEN;

/**
 * Explicit opt-in: only private repos listed here (comma-separated
 * "owner/name") get their name, description, URL, and star count written to
 * github.json's `repos` list. Every other private repo GH_STATS_PRIVATE_TOKEN
 * can see still contributes anonymously to the language mix and commit
 * clock, but is never named — printing a repo's name on a public page makes
 * it search-indexable even though the link itself 404s for non-collaborators,
 * so naming one is a deliberate per-repo choice, not automatic.
 */
const SHOWCASE_REPOS = new Set(
  (process.env.GH_STATS_SHOWCASE_REPOS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
);

/** Repos scanned for commit timestamps, most recently pushed first. */
const CLOCK_REPO_LIMIT = 30;
/** Commits read per repo for the time-of-day histogram. */
const CLOCK_COMMIT_LIMIT = 100;

const ENDPOINT = "https://api.github.com/graphql";

async function graphql(query, variables, token = TOKEN) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "sharkbeans-site-stats",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API responded ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return payload.data;
}

const PROFILE_QUERY = `
  query ($login: String!) {
    user(login: $login) {
      id
      login
      name
      createdAt
      followers { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
      repositories(
        first: 100
        privacy: PUBLIC
        isFork: false
        ownerAffiliations: OWNER
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        totalCount
        nodes {
          name
          nameWithOwner
          url
          description
          stargazerCount
          forkCount
          isArchived
          pushedAt
          primaryLanguage { name color }
          languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node { name color }
            }
          }
        }
      }
    }
  }
`;

/**
 * Runs as the private token's own identity (viewer), not the profile login —
 * the two tokens can belong to the same account without this query needing
 * to know that. privacy: PRIVATE means this can never re-fetch (and thus
 * never double-count) a repo the public query already covered.
 */
const PRIVATE_REPOS_QUERY = `
  query ($limit: Int!) {
    viewer {
      repositories(
        first: $limit
        privacy: PRIVATE
        isFork: false
        ownerAffiliations: [OWNER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        nodes {
          name
          nameWithOwner
          url
          description
          stargazerCount
          forkCount
          isArchived
          pushedAt
          primaryLanguage { name color }
          languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node { name color }
            }
          }
        }
      }
    }
  }
`;

const HISTORY_QUERY = `
  query ($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $limit: Int!) {
    repository(owner: $owner, name: $name) {
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: $limit, author: { id: $authorId }, since: $since) {
              totalCount
              nodes { committedDate }
            }
          }
        }
      }
    }
  }
`;

/** Fixed reporting timezone for the commit clock: Kuala Lumpur, UTC+8, no DST. */
const CLOCK_OFFSET_MINUTES = 8 * 60;

/**
 * committedDate is a GitTimestamp, which keeps whichever offset the commit
 * was authored in — that varies by machine/CI and isn't meaningful on its
 * own. Parse it to an absolute instant, then shift to the fixed reporting
 * offset and read the UTC fields back off that shifted instant to get a
 * consistent Kuala Lumpur wall-clock hour/weekday for every commit.
 */
function localParts(committedDate) {
  const instant = new Date(committedDate);
  const shifted = new Date(instant.getTime() + CLOCK_OFFSET_MINUTES * 60 * 1000);
  return { hour: shifted.getUTCHours(), weekday: shifted.getUTCDay() };
}

/** entries: flat list of { name, color, size } — repo identity already stripped by the caller. */
function aggregateLanguages(entries) {
  const totals = new Map();

  for (const entry of entries) {
    const existing = totals.get(entry.name);
    totals.set(entry.name, {
      name: entry.name,
      color: entry.color ?? existing?.color ?? null,
      size: (existing?.size ?? 0) + entry.size,
    });
  }

  return [...totals.values()].sort((a, b) => b.size - a.size);
}

function languageEntriesFromRepo(repo) {
  return (repo.languages?.edges ?? []).map((edge) => ({
    name: edge.node.name,
    color: edge.node.color ?? null,
    size: edge.size,
  }));
}

function toRepoEntry(repo, isPrivate) {
  return {
    name: repo.name,
    url: repo.url,
    description: repo.description,
    stars: repo.stargazerCount,
    forks: repo.forkCount,
    language: repo.primaryLanguage?.name ?? null,
    languageColor: repo.primaryLanguage?.color ?? null,
    isArchived: repo.isArchived,
    isPrivate,
    pushedAt: repo.pushedAt,
  };
}

/**
 * Every private repo GH_STATS_PRIVATE_TOKEN can see, with just enough to
 * feed the language mix and commit clock (nameWithOwner is used to query
 * commit history below, never written to the output).
 */
async function fetchPrivateRepos() {
  if (!PRIVATE_TOKEN) return [];

  try {
    const data = await graphql(PRIVATE_REPOS_QUERY, { limit: 100 }, PRIVATE_TOKEN);
    return (data.viewer?.repositories?.nodes ?? []).filter(Boolean);
  } catch (error) {
    console.warn(`[github-stats] Private repo discovery skipped: ${error.message}`);
    return [];
  }
}

/** sources: [{ repos: [{ nameWithOwner }], token }, ...] — scanned in order, each capped independently. */
async function fetchCommitClock(sources, authorId) {
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const hours = new Array(24).fill(0);
  const weekdays = new Array(7).fill(0);
  let sampled = 0;
  let scanned = 0;

  for (const { repos, token } of sources) {
    for (const repo of repos.slice(0, CLOCK_REPO_LIMIT)) {
      const [owner, name] = repo.nameWithOwner.split("/");
      try {
        const data = await graphql(
          HISTORY_QUERY,
          { owner, name, authorId, since, limit: CLOCK_COMMIT_LIMIT },
          token,
        );
        const nodes = data.repository?.defaultBranchRef?.target?.history?.nodes ?? [];
        scanned += 1;

        for (const commit of nodes) {
          const { hour, weekday } = localParts(commit.committedDate);
          hours[hour] += 1;
          weekdays[weekday] += 1;
          sampled += 1;
        }
      } catch (error) {
        console.warn(`[github-stats] Commit clock: repo skipped (${error.message})`);
      }
    }
  }

  return { sampled, reposScanned: scanned, hours, weekdays };
}

async function main() {
  if (!TOKEN) {
    console.warn("[github-stats] No GH_STATS_TOKEN or GITHUB_TOKEN set — keeping existing JSON.");
    return;
  }

  const data = await graphql(PROFILE_QUERY, { login: LOGIN });
  const user = data.user;

  if (!user) {
    throw new Error(`No public user found for login "${LOGIN}"`);
  }

  const contributions = user.contributionsCollection;
  const repos = (user.repositories.nodes ?? []).filter(Boolean);
  const privateRepos = await fetchPrivateRepos();

  let commitClock = null;
  try {
    const sources = [{ repos, token: TOKEN }];
    if (privateRepos.length > 0) sources.push({ repos: privateRepos, token: PRIVATE_TOKEN });
    commitClock = await fetchCommitClock(sources, user.id);
  } catch (error) {
    // The calendar is the headline feature; losing the clock shouldn't cost us
    // the rest of the page.
    console.warn(`[github-stats] Commit clock skipped: ${error.message}`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    login: user.login,
    profile: {
      name: user.name,
      createdAt: user.createdAt,
      followers: user.followers.totalCount,
      publicRepos: user.repositories.totalCount,
      /** Folded into the language mix / commit clock either way; named in `repos` only if listed in GH_STATS_SHOWCASE_REPOS. */
      privateRepoCount: privateRepos.length,
    },
    contributions: {
      total: contributions.contributionCalendar.totalContributions,
      commits: contributions.totalCommitContributions,
      pullRequests: contributions.totalPullRequestContributions,
      issues: contributions.totalIssueContributions,
      reviews: contributions.totalPullRequestReviewContributions,
      private: contributions.restrictedContributionsCount,
      weeks: contributions.contributionCalendar.weeks.map((week) => ({
        days: week.contributionDays.map((day) => ({
          date: day.date,
          count: day.contributionCount,
        })),
      })),
    },
    languages: aggregateLanguages([
      ...repos.flatMap(languageEntriesFromRepo),
      ...privateRepos.flatMap(languageEntriesFromRepo),
    ]),
    repos: [
      ...repos.map((repo) => toRepoEntry(repo, false)),
      ...privateRepos
        .filter((repo) => SHOWCASE_REPOS.has(repo.nameWithOwner))
        .map((repo) => toRepoEntry(repo, true)),
    ],
    commitClock,
  };

  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);

  const showcasedCount = payload.repos.length - repos.length;
  console.log(
    `[github-stats] ${payload.contributions.total} contributions, ` +
      `${repos.length} public repos` +
      `${
        privateRepos.length > 0
          ? ` + ${privateRepos.length} private (folded, ${showcasedCount} shown by name)`
          : ""
      }, ` +
      `${commitClock ? `${commitClock.sampled} commits sampled` : "no commit clock"}`,
  );
}

main().catch((error) => {
  console.warn(`[github-stats] Fetch failed, keeping existing JSON: ${error.message}`);
});
