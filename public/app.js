const app = document.getElementById("app");
const userForm = document.getElementById("user-form");
const usernameInput = document.getElementById("username");
const refreshBtn = document.getElementById("refresh-btn");

const savedUsername = localStorage.getItem("anipace_username");
if (savedUsername) {
  usernameInput.value = savedUsername;
  loadToday(savedUsername);
}

userForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = usernameInput.value.trim();
  if (!u) return;
  localStorage.setItem("anipace_username", u);
  loadToday(u);
});

refreshBtn.addEventListener("click", () => {
  const u = usernameInput.value.trim();
  if (!u) return;
  loadToday(u, { refresh: true });
});

async function loadToday(username, { refresh = false } = {}) {
  app.innerHTML = `<p class="empty-state">${refresh ? "Refreshing from AniList/MangaDex…" : "Loading your lists from AniList…"}</p>`;
  try {
    const qs = new URLSearchParams({ username });
    if (refresh) qs.set("refresh", "1");
    const [todayRes, goalsRes] = await Promise.all([
      fetch(`/api/today?${qs.toString()}`),
      fetch(`/api/goals`),
    ]);
    if (!todayRes.ok) throw new Error((await todayRes.json()).error || "Failed to load");
    const { catchUp, mangaCatchUp, paceToday } = await todayRes.json();
    render(username, catchUp, mangaCatchUp, paceToday);
  } catch (err) {
    app.innerHTML = `<p class="empty-state">Couldn't load that username — ${escapeHtml(err.message)}</p>`;
  }
}

function render(username, catchUp, mangaCatchUp, paceToday) {
  app.innerHTML = "";
  app.appendChild(section(
    "Catch up — anime",
    "Currently airing — episodes already out that you haven't watched yet.",
    catchUp.length
      ? catchUp.map(catchUpCard).join("")
      : `<p class="empty-state" style="margin-top:0">You're fully caught up on everything airing. 🎬</p>`
  ));

  app.appendChild(mangaSection(username, mangaCatchUp));

  app.appendChild(section(
    "Pace goals",
    "Titles with a target finish date — today's recommended dose to stay on schedule.",
    paceToday.length
      ? paceToday.map(paceCard).join("")
      : `<p class="empty-state" style="margin-top:0">No pace goals yet. Add one below.</p>`
  ));

  app.appendChild(goalFormBlock());
  wireDeleteButtons(username);
  wireGoalForm(username);
}

function mangaSection(username, mangaCatchUp) {
  const { linked, unlinked } = mangaCatchUp;
  const wrap = document.createElement("section");
  wrap.innerHTML = `
    <div class="section-head"><h2>Catch up — manga</h2><div class="sprocket-rule"></div></div>
    <p class="section-sub">Via MangaDex — chapters out that you haven't read. Link a title once to enable it.</p>
    <div class="card-grid" id="manga-linked">
      ${linked.length
        ? linked.map(mangaCatchUpCard).join("")
        : `<p class="empty-state" style="margin-top:0">${unlinked.length ? "No linked titles are behind." : "You're fully caught up. 📖"}</p>`}
    </div>
    ${unlinked.length ? `
      <p class="section-sub" style="margin-top:22px">Not linked yet — reading list titles anipace can't check:</p>
      <div class="card-grid" id="manga-unlinked">
        ${unlinked.map(unlinkedMangaRow).join("")}
      </div>
    ` : ""}
  `;
  wireMangaLinking(username, wrap);
  wireMangaUnlink(username, wrap);
  return wrap;
}

function mangaCatchUpCard(item) {
  const range = item.behind === 1
    ? `Ch ${item.nextChapterToRead}`
    : `Ch ${item.nextChapterToRead}–${item.latestChapter}`;
  const time = item.minutesEstimate ? ` · ${formatMinutes(item.minutesEstimate)} (est. reading pace)` : "";
  return `
    <div class="card">
      <img src="${item.cover}" alt="" />
      <div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="meta">${range} · read ${item.progress}/${item.latestChapter}${time}</div>
      </div>
      <div class="card-actions">
        <span class="pill behind">${item.behind} behind</span>
        <button class="icon-btn" data-unlink="${item.mediaId}">Unlink</button>
      </div>
    </div>
  `;
}

function unlinkedMangaRow(item) {
  return `
    <div class="card link-card" data-anilist-id="${item.mediaId}">
      <img src="${item.cover}" alt="" />
      <div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="meta">read ${item.progress} so far</div>
      </div>
      <div class="link-search">
        <input type="text" class="md-search-input" placeholder="Search MangaDex…" value="${escapeHtml(item.title)}" />
        <div class="search-dropdown md-dropdown" style="display:none"></div>
      </div>
    </div>
  `;
}

function wireMangaLinking(username, root) {
  root.querySelectorAll(".link-card").forEach((card) => {
    const anilistId = card.dataset.anilistId;
    const input = card.querySelector(".md-search-input");
    const dropdown = card.querySelector(".md-dropdown");
    let timer = null;

    const runSearch = async () => {
      const q = input.value.trim();
      if (!q) { dropdown.style.display = "none"; return; }
      const res = await fetch(`/api/mangadex/search?q=${encodeURIComponent(q)}`);
      const results = await res.json();
      if (!results.length) { dropdown.innerHTML = `<div style="color:var(--muted)">No matches</div>`; dropdown.style.display = "block"; return; }
      dropdown.innerHTML = results.map((r) => `
        <div data-md-id="${r.mangadexId}" data-md-title="${escapeHtml(r.title)}">
          <span>${escapeHtml(r.title)}</span>
          <span style="color:var(--muted)">${r.year || ""} ${r.status || ""}</span>
        </div>
      `).join("");
      dropdown.style.display = "block";
    };

    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runSearch, 300); });
    input.addEventListener("focus", runSearch);

    dropdown.addEventListener("click", async (e) => {
      const row = e.target.closest("[data-md-id]");
      if (!row) return;
      await fetch("/api/manga-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId: Number(anilistId), mangadexId: row.dataset.mdId, mangadexTitle: row.dataset.mdTitle }),
      });
      loadToday(username);
    });
  });
}

function wireMangaUnlink(username, root) {
  root.querySelectorAll("[data-unlink]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/manga-links/${btn.dataset.unlink}`, { method: "DELETE" });
      loadToday(username);
    });
  });
}

function section(title, sub, innerHtml) {
  const wrap = document.createElement("section");
  wrap.innerHTML = `
    <div class="section-head"><h2>${title}</h2><div class="sprocket-rule"></div></div>
    <p class="section-sub">${sub}</p>
    <div class="card-grid">${innerHtml}</div>
  `;
  return wrap;
}

function catchUpCard(item) {
  const range = item.behind === 1
    ? `Ep ${item.nextEpisodeToWatch}`
    : `Ep ${item.nextEpisodeToWatch}–${item.airedEpisodes}`;
  const time = item.totalMinutes ? ` · ${formatMinutes(item.totalMinutes)}` : "";
  return `
    <div class="card">
      <img src="${item.cover}" alt="" />
      <div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="meta">${range} · watched ${item.progress}/${item.airedEpisodes ?? "?"}${time}</div>
      </div>
      <span class="pill behind">${item.behind} behind</span>
    </div>
  `;
}

function formatMinutes(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `~${m}m`;
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
}

function paceCard(item) {
  const pct = item.totalUnits ? Math.min(100, Math.round((item.progress / item.totalUnits) * 100)) : 0;
  const statusPill = {
    "done": `<span class="pill done">done</span>`,
    "overdue": `<span class="pill overdue">overdue</span>`,
    "final-day": `<span class="pill overdue">final day</span>`,
    "on-track": `<span class="pill ontrack">+${item.recommendedToday} today</span>`,
  }[item.status];

  const unit = item.mediaType === "ANIME" ? "ep" : "ch";
  const timeBit = item.minutesToday
    ? ` · ${formatMinutes(item.minutesToday)} today${item.durationIsEstimate ? " (est.)" : ""}`
    : "";
  return `
    <div class="card">
      <img src="${item.cover || ""}" alt="" />
      <div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="meta">${item.progress}${item.totalUnits ? "/" + item.totalUnits : ""} ${unit} · target ${item.targetDate} · ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} left${timeBit}</div>
      </div>
      <div class="card-actions">
        ${statusPill}
        <button class="icon-btn" data-delete-goal="${item.id}">Remove</button>
      </div>
      <div class="track"><div class="track-fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function goalFormBlock() {
  const wrap = document.createElement("div");
  wrap.className = "goal-form-wrap";
  wrap.innerHTML = `
    <div class="section-head" style="margin:0 0 14px"><h2 style="font-size:15px">Add a pace goal</h2></div>
    <form class="goal-form" id="goal-form" autocomplete="off">
      <div class="search-results">
        <label for="goal-search">Title</label>
        <input id="goal-search" type="text" placeholder="Search AniList…" />
        <div id="goal-dropdown" class="search-dropdown" style="display:none"></div>
        <input type="hidden" id="goal-media-id" />
        <input type="hidden" id="goal-media-type" value="ANIME" />
        <input type="hidden" id="goal-cover" />
        <input type="hidden" id="goal-total" />
        <input type="hidden" id="goal-duration" />
      </div>
      <div>
        <label for="goal-type">Type</label>
        <select id="goal-type">
          <option value="ANIME">Anime</option>
          <option value="MANGA">Manga</option>
        </select>
      </div>
      <div>
        <label for="goal-date">Finish by</label>
        <input id="goal-date" type="date" required />
      </div>
      <button type="submit">Add</button>
    </form>
  `;
  return wrap;
}

function wireGoalForm(username) {
  const typeSelect = document.getElementById("goal-type");
  const searchInput = document.getElementById("goal-search");
  const dropdown = document.getElementById("goal-dropdown");
  let selected = null;
  let debounceTimer = null;

  searchInput.addEventListener("input", () => {
    selected = null;
    document.getElementById("goal-media-id").value = "";
    clearTimeout(debounceTimer);
    const q = searchInput.value.trim();
    if (!q) { dropdown.style.display = "none"; return; }
    debounceTimer = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${typeSelect.value}`);
      const results = await res.json();
      if (!results.length) { dropdown.style.display = "none"; return; }
      dropdown.innerHTML = results.map((r) => `
        <div data-id="${r.mediaId}" data-cover="${r.cover}" data-total="${r.totalUnits ?? ""}" data-duration="${r.durationMinutes ?? ""}" data-title="${escapeHtml(r.title)}">
          <span>${escapeHtml(r.title)}</span><span style="color:var(--muted)">${r.totalUnits ? r.totalUnits + (typeSelect.value === "ANIME" ? " ep" : " ch") : "?"}</span>
        </div>
      `).join("");
      dropdown.style.display = "block";
    }, 300);
  });

  dropdown.addEventListener("click", (e) => {
    const row = e.target.closest("[data-id]");
    if (!row) return;
    selected = {
      mediaId: row.dataset.id,
      cover: row.dataset.cover,
      totalUnits: row.dataset.total || null,
      durationMinutes: row.dataset.duration || null,
      title: row.dataset.title,
    };
    searchInput.value = selected.title;
    document.getElementById("goal-media-id").value = selected.mediaId;
    document.getElementById("goal-cover").value = selected.cover;
    document.getElementById("goal-total").value = selected.totalUnits || "";
    document.getElementById("goal-duration").value = selected.durationMinutes || "";
    dropdown.style.display = "none";
  });

  document.getElementById("goal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selected) { alert("Pick a title from the search results first."); return; }
    const targetDate = document.getElementById("goal-date").value;
    if (!targetDate) return;

    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaId: Number(selected.mediaId),
        mediaType: typeSelect.value,
        title: selected.title,
        cover: selected.cover,
        totalUnits: selected.totalUnits ? Number(selected.totalUnits) : null,
        durationMinutes: selected.durationMinutes ? Number(selected.durationMinutes) : null,
        targetDate,
      }),
    });
    loadToday(username);
  });
}

function wireDeleteButtons(username) {
  document.querySelectorAll("[data-delete-goal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch(`/api/goals/${btn.dataset.deleteGoal}`, { method: "DELETE" });
      loadToday(username);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
