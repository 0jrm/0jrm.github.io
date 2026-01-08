"use strict";

/**
 * Configuration
 */
const USERNAME = "0jrm";

// If you want fully curated repos (no API), set false and edit FALLBACK_REPOS below.
const USE_GITHUB_API = true;

// How many repos to show.
const REPO_COUNT = 9;

// Cache GitHub API response to reduce rate-limit pain (in ms).
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

const FALLBACK_REPOS = [
  {
    name: "nespreso_api",
    html_url: "https://github.com/0jrm/nespreso_api",
    description: "APIs / notebooks around a modeling workflow.",
    language: "Python",
    stargazers_count: 0,
    updated_at: new Date().toISOString()
  },
  {
    name: "ML-Papers-Explained",
    html_url: "https://github.com/0jrm/ML-Papers-Explained",
    description: "Notes + explanations for ML papers.",
    language: "Jupyter Notebook",
    stargazers_count: 0,
    updated_at: new Date().toISOString()
  },
  {
    name: "0jrm.github.io",
    html_url: "https://github.com/0jrm/0jrm.github.io",
    description: "Personal website / GitHub Pages.",
    language: "HTML",
    stargazers_count: 0,
    updated_at: new Date().toISOString()
  }
];

/**
 * Helpers
 */
const $ = (sel) => document.querySelector(sel);

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function compactNumber(n) {
  if (typeof n !== "number") return "—";
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || "dark";
  setTheme(current === "dark" ? "light" : "dark");
}

/**
 * Repo rendering
 */
function repoCard(repo) {
  const name = escapeHtml(repo.name);
  const desc = escapeHtml(repo.description || "No description yet.");
  const lang = escapeHtml(repo.language || "—");
  const stars = typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0;
  const updated = repo.updated_at ? formatDate(repo.updated_at) : "—";
  const url = repo.html_url || "#";

  return `
    <article class="repoCard">
      <div class="repoTop">
        <div>
          <a class="repoName" href="${url}" target="_blank" rel="noreferrer">
            ${name}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        <span class="badge" title="Stars">★ ${compactNumber(stars)}</span>
      </div>
      <p class="repoDesc">${desc}</p>
      <div class="repoMeta">
        <span class="badge"><span aria-hidden="true">⌁</span> <code>${lang}</code></span>
        <span class="badge" title="Last update"><span aria-hidden="true">⟲</span> ${updated}</span>
      </div>
    </article>
  `;
}

function renderRepos(repos) {
  const grid = $("#repoGrid");
  if (!grid) return;

  if (!Array.isArray(repos) || repos.length === 0) {
    grid.innerHTML = `<div class="card"><h3>No repos found</h3><p class="muted">Try refreshing, or check GitHub.</p></div>`;
    return;
  }

  grid.innerHTML = repos.map(repoCard).join("");
}

function applyRepoSearch(repos, query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return repos;

  return repos.filter((r) => {
    const hay = `${r.name || ""} ${r.description || ""} ${r.language || ""}`.toLowerCase();
    return hay.includes(q);
  });
}

/**
 * GitHub API fetch with caching
 */
function loadCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (Date.now() - parsed.time > CACHE_TTL) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

function saveCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ time: Date.now(), value }));
  } catch {
    // ignore
  }
}

async function fetchReposFromGitHub() {
  const cacheKey = `gh_repos_${USERNAME}`;
  const cached = loadCache(cacheKey);
  if (cached) return cached;

  const url = new URL(`https://api.github.com/users/${USERNAME}/repos`);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("sort", "updated");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/vnd.github+json"
    }
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  const data = await res.json();
  // Filter out forks if you want only original work:
  // const filtered = data.filter(r => !r.fork);
  const filtered = Array.isArray(data) ? data : [];
  saveCache(cacheKey, filtered);
  return filtered;
}

function summarizeStats(repos) {
  const statRepos = $("#statRepos");
  const statStars = $("#statStars");
  const statUpdated = $("#statUpdated");

  if (!statRepos || !statStars || !statUpdated) return;

  const totalRepos = repos.length;
  const totalStars = repos.reduce((acc, r) => acc + (r.stargazers_count || 0), 0);
  const mostRecent = repos
    .map((r) => r.updated_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  statRepos.textContent = compactNumber(totalRepos);
  statStars.textContent = compactNumber(totalStars);
  statUpdated.textContent = mostRecent ? formatDate(mostRecent) : "—";
}

/**
 * Main
 */
let ALL_REPOS = [];

async function initRepos() {
  let repos = FALLBACK_REPOS;

  if (USE_GITHUB_API) {
    try {
      repos = await fetchReposFromGitHub();
    } catch (e) {
      // Keep fallback; optionally show a tiny hint in console.
      console.warn(e);
      repos = FALLBACK_REPOS;
    }
  }

  // Sort by updated desc, then take top N (and drop archived by default).
  repos = repos
    .filter((r) => !r.archived)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, REPO_COUNT);

  ALL_REPOS = repos;
  renderRepos(repos);
  summarizeStats(repos);
}

function bindUI() {
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  const themeToggle = $("#themeToggle");
  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  const search = $("#repoSearch");
  if (search) {
    search.addEventListener("input", (e) => {
      const filtered = applyRepoSearch(ALL_REPOS, e.target.value);
      renderRepos(filtered);
    });
  }

  const refresh = $("#refreshRepos");
  if (refresh) {
    refresh.addEventListener("click", async () => {
      // clear cache
      try { localStorage.removeItem(`gh_repos_${USERNAME}`); } catch {}
      refresh.disabled = true;
      refresh.textContent = "Refreshing…";
      await initRepos();
      refresh.disabled = false;
      refresh.textContent = "Refresh";
    });
  }
}

bindUI();
initRepos();
