"use strict";

const USERNAME = "0jrm";
const SHOW_REPOS = 6;

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function repoCard(r) {
  const name = escapeHtml(r.name);
  const desc = escapeHtml(r.description || "—");
  const lang = escapeHtml(r.language || "—");
  const stars = typeof r.stargazers_count === "number" ? r.stargazers_count : 0;
  const updated = r.updated_at ? formatDate(r.updated_at) : "—";
  const url = r.html_url || "#";

  return `
    <article class="repo">
      <a class="repo__name" href="${url}" target="_blank" rel="noreferrer">${name}</a>
      <p class="repo__desc">${desc}</p>
      <div class="repo__meta">
        <span class="kv">⌁ ${lang}</span>
        <span class="kv">★ ${stars}</span>
        <span class="kv">⟲ ${updated}</span>
      </div>
    </article>
  `;
}

async function loadRepos() {
  const el = document.getElementById("repos");
  if (!el) return;

  try {
    const url = new URL(`https://api.github.com/users/${USERNAME}/repos`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("sort", "updated");

    const res = await fetch(url.toString(), { headers: { "Accept": "application/vnd.github+json" } });
    if (!res.ok) throw new Error(String(res.status));

    const data = await res.json();
    const repos = (Array.isArray(data) ? data : [])
      .filter(r => !r.archived)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, SHOW_REPOS);

    el.innerHTML = repos.map(repoCard).join("");
  } catch {
    el.innerHTML = `
      <div class="repo">
        <div class="repo__name">Repos unavailable</div>
        <p class="repo__desc">GitHub API rate-limited or offline. Use the “View all repositories” link below.</p>
        <div class="repo__meta"><span class="kv">—</span></div>
      </div>
    `;
  }
}

document.getElementById("y").textContent = String(new Date().getFullYear());
loadRepos();
