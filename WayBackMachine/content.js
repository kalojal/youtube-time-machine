// Scale modern views down to match your Virtual Clock
function estimateVirtualViews(viewText, uploadTimestamp, virtualNow) {
  const match = viewText.match(/([\d,.]+)\s*([KMB])?/i);
  if (!match) return null;

  const num = parseFloat(match.at(1).replace(/,/g, ""));
  if (isNaN(num)) return null;

  const suffix = (match.at(2) || "").toUpperCase();
  let multiplier = 1;
  if (suffix === "K") multiplier = 1000;
  else if (suffix === "M") multiplier = 1000000;
  else if (suffix === "B") multiplier = 1000000000;

  const totalModernViews = num * multiplier;
  const totalLifespanMs = Math.max(Date.now() - uploadTimestamp, 60000);
  const virtualLifespanMs = Math.max(virtualNow - uploadTimestamp, 1000);
  const ratio = Math.min(Math.max(virtualLifespanMs / totalLifespanMs, 0.01), 1);
  const scaled = Math.floor(totalModernViews * ratio);

  const tail = viewText.toLowerCase().includes("view") ? " views" : "";
  if (scaled >= 1000000000) return `${(scaled / 1000000000).toFixed(1).replace(/\.0$/, "")}B${tail}`;
  if (scaled >= 1000000) return `${(scaled / 1000000).toFixed(1).replace(/\.0$/, "")}M${tail}`;
  if (scaled >= 1000) return `${(scaled / 1000).toFixed(1).replace(/\.0$/, "")}K${tail}`;
  return `${scaled.toLocaleString()}${tail}`;
}

// 1. Parse exact date ("Aug 12, 2016") OR relative text ("8d ago", "2mo ago", "8 years ago")
function parseVideoUploadTimestamp(text, seedText = "") {

  const clean = text.trim();

  const parsedDate = Date.parse(clean);
  if (!isNaN(parsedDate) && /[a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4}/.test(clean)) {
    return parsedDate;
  }

  const lower = clean.toLowerCase();
  const match = lower.match(/(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day|w|wk|week|mo|month|y|yr|year)s?\s*ago/);
  if (!match) return null;

  const fullMatch = match.at(0);
  const amount = parseInt(fullMatch, 10);
  const unitRaw = fullMatch.replace(/^\d+\s*/, "").replace(/s?\s*ago$/, "").trim();

  let ms = 24 * 60 * 60 * 1000;
  if (unitRaw.startsWith("s")) ms = 1000;
  else if (unitRaw === "m" || unitRaw.startsWith("min")) ms = 60 * 1000;
  else if (unitRaw.startsWith("h")) ms = 60 * 60 * 1000;
  else if (unitRaw.startsWith("d")) ms = 24 * 60 * 60 * 1000;
  else if (unitRaw.startsWith("w")) ms = 7 * 24 * 60 * 60 * 1000;
  else if (unitRaw.startsWith("mo")) ms = 30.44 * 24 * 60 * 60 * 1000;
  else if (unitRaw.startsWith("y")) ms = 365.25 * 24 * 60 * 60 * 1000;

  return Date.now() - (amount * ms);
}

// 2. Format age compared to Virtual Clock
function formatRelativeToVirtualClock(virtualNow, uploadTimestamp) {
  let diffHours = Math.floor((virtualNow - uploadTimestamp) / (1000 * 60 * 60));

  // If YouTube rounded a multi-year video ("9 years ago") to today's exact day/hour,
  // spread it naturally across 1 to 10 months so every video doesn't say "5 hours ago"
  if (diffHours >= 0 && diffHours < 24) {
    const pseudoRandomDays = ((Math.abs(Math.floor(uploadTimestamp / 1000)) % 270) + 30);
    diffHours += pseudoRandomDays * 24;
  }

  if (diffHours < 1) return "Just now (Today)";
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago (Today)`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday (1 day ago)";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffDays < 30) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;

  const diffMonths = Math.floor(diffDays / 30.44);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;

  const diffYears = Math.floor(diffDays / 365.25);
  return `${diffYears} year${diffYears === 1 ? "" : "s"} ago`;
}


// 3. Clickable date toggle (Virtual Age <-> Actual Date)
function makeDateToggleable(el, virtualLabel, actualDateLabel) {
  el.dataset.tmVirtual = virtualLabel;
  el.dataset.tmActual = actualDateLabel;

  if (!el.dataset.tmMode) el.dataset.tmMode = "virtual";
  el.textContent = el.dataset.tmMode === "virtual" ? virtualLabel : actualDateLabel;

  if (!el.dataset.tmClickable) {
    el.dataset.tmClickable = "true";
    el.style.cursor = "pointer";
    el.style.textDecoration = "underline dotted";
    el.title = "Click to toggle Virtual Age / Actual Date";

    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.dataset.tmMode = el.dataset.tmMode === "virtual" ? "actual" : "virtual";
      el.textContent = el.dataset.tmMode === "virtual" ? el.dataset.tmVirtual : el.dataset.tmActual;
    });
  }
}

// 4. Completely remove Shorts & Mixes
function removeShortsAndMixes() {
  document.querySelectorAll(
    "ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-rich-section-renderer, ytd-guide-entry-renderer a[title='Shorts'], ytd-mini-guide-entry-renderer a[title='Shorts'], yt-tab-shape[tab-title='Shorts']"
  ).forEach((el) => {
    const target = el.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer") || el;
    target.style.display = "none";
  });

  document.querySelectorAll("a[href*='/shorts/'], a[href*='start_radio=1']").forEach((link) => {
    const card = link.closest("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model");
    if (card) card.style.display = "none";
  });

  document.querySelectorAll("ytd-radio-renderer, ytd-compact-radio-renderer").forEach((el) => {
    el.style.display = "none";
  });
}

// 5. Strict video filter: hides ALL future & unverified videos
function filterVideosByTime(virtualNow) {
  removeShortsAndMixes();

  const videoCards = document.querySelectorAll(
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model"
  );

  let hiddenCount = 0;

  videoCards.forEach((card) => {
    const fullText = card.textContent || "";

    if (fullText.includes("watching") || fullText.includes("LIVE") || fullText.includes("Mix - ")) {
      card.style.display = "none";
      hiddenCount++;
      return;
    }

    let foundValidPastDate = false;

    card.querySelectorAll("span, div, yt-formatted-string").forEach((el) => {
      if (el.children.length > 0) return;
      const originalText = el.dataset.originalDate || el.textContent.trim();
      if (!originalText) return;

      if (originalText.includes("ago") || /[a-zA-Z]{3,}\s+\d{1,2},?\s+\d{4}/.test(originalText)) {
        const estimatedUpload = parseVideoUploadTimestamp(originalText);
        if (estimatedUpload) {
          el.dataset.originalDate = originalText;
          if (estimatedUpload <= virtualNow) {
            foundValidPastDate = true;
            const virtualLabel = formatRelativeToVirtualClock(virtualNow, estimatedUpload);
            const actualStr = new Date(estimatedUpload).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric"
            });
            makeDateToggleable(el, virtualLabel, `Actual: ${actualStr}`);
          }
        }
      }
    });

    if (foundValidPastDate) {
      card.style.display = "";
    } else {
      card.style.display = "none";
      hiddenCount++;
    }
  });

  // Watch page description date toggle
  const infoHeader = document.querySelector("#info-container #info");
  if (infoHeader && !infoHeader.dataset.tmPrepared) {
    const dateMatch = infoHeader.textContent.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})/);
    if (dateMatch) {
      const dateStr = dateMatch.at(0);
      const parsed = Date.parse(dateStr);
      if (!isNaN(parsed) && parsed <= virtualNow) {
        infoHeader.dataset.tmPrepared = "true";
        infoHeader.innerHTML = infoHeader.innerHTML.replace(dateStr, `<span id="tm-watch-date">${dateStr}</span>`);
        const span = document.getElementById("tm-watch-date");
        if (span) {
          makeDateToggleable(span, formatRelativeToVirtualClock(virtualNow, parsed), `Actual: ${dateStr}`);
        }
      }
    }
  }

  // Bottom-left status badge
  let badge = document.getElementById("tm-status-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "tm-status-badge";
    badge.style.cssText = "position:fixed;bottom:12px;left:12px;background:#cc0000;color:#fff;padding:6px 10px;font:bold 12px Arial;z-index:99999;border-radius:3px;";
    document.body.appendChild(badge);
  }
  badge.textContent = `Time Machine: ${new Date(virtualNow).toLocaleDateString()} | Blocked: ${hiddenCount}`;
}

// 6. Unsaved Local Comments Box
function injectFakeCommentBox() {
  if (!window.location.pathname.startsWith("/watch") || document.getElementById("yt-timemachine-comments")) return;
  const commentsSection = document.querySelector("ytd-comments#comments");
  if (!commentsSection) return;

  const box = document.createElement("div");
  box.id = "yt-timemachine-comments";
  box.style.cssText = "background:#f1f1f1;border:1px solid #ccc;padding:12px;margin-bottom:16px;font-family:Arial,sans-serif;color:#222;";
  box.innerHTML = `
    <div style="font-weight:bold;font-size:13px;margin-bottom:6px;color:#cc0000;">Time Machine Local Comments (Won't Save on Refresh)</div>
    <input id="tm-username" type="text" placeholder="Your Username" style="width:220px;padding:5px;margin-bottom:6px;border:1px solid #bbb;display:block;">
    <textarea id="tm-comment-text" rows="3" placeholder="Add a public comment..." style="width:100%;padding:6px;box-sizing:border-box;border:1px solid #bbb;"></textarea>
    <button id="tm-post-btn" style="margin-top:6px;padding:6px 14px;background:#167ac6;color:#fff;border:none;font-weight:bold;cursor:pointer;">Post Comment</button>
    <div id="tm-comment-list" style="margin-top:12px;"></div>
  `;
  commentsSection.parentNode.insertBefore(box, commentsSection);

  document.getElementById("tm-post-btn").addEventListener("click", () => {
    const user = document.getElementById("tm-username").value.trim() || "TimeTraveler";
    const text = document.getElementById("tm-comment-text").value.trim();
    if (!text) return;
    const item = document.createElement("div");
    item.style.cssText = "background:#fff;border:1px solid #ddd;padding:8px;margin-top:8px;font-size:13px;";
    item.innerHTML = `<strong style="color:#167ac6;">${user}</strong> <span style="color:#777;font-size:11px;">Just now</span><p style="margin:4px 0 0 0;">${text}</p>`;
    document.getElementById("tm-comment-list").prepend(item);
    document.getElementById("tm-comment-text").value = "";
  });
}

// 7. Instant Watcher (Catches new videos the exact millisecond you scroll)
let cachedVirtualStart = null;
let cachedRealStart = null;

function runTimeMachine() {
  if (!cachedVirtualStart || !cachedRealStart) {
    removeShortsAndMixes();
    return;
  }
  const virtualNow = cachedVirtualStart + (Date.now() - cachedRealStart);
  filterVideosByTime(virtualNow);
  injectFakeCommentBox();
}

// Load saved clock once and listen for changes
chrome.storage.local.get(["historicalStart", "realStart"], (data) => {
  cachedVirtualStart = data.historicalStart;
  cachedRealStart = data.realStart;
  runTimeMachine();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.historicalStart) cachedVirtualStart = changes.historicalStart.newValue;
  if (changes.realStart) cachedRealStart = changes.realStart.newValue;
  runTimeMachine();
});

// Watch the page in real time as you scroll (debounced for smooth scrolling)
let scrollTimeout = null;
const observer = new MutationObserver(() => {
  if (scrollTimeout) return;
  scrollTimeout = setTimeout(() => {
    scrollTimeout = null;
    runTimeMachine();
  }, 150);
});

observer.observe(document.body, { childList: true, subtree: true });

// Scale and toggle view counts across video cards
setInterval(() => {
  if (!cachedVirtualStart || !cachedRealStart) return;
  const virtualNow = cachedVirtualStart + (Date.now() - cachedRealStart);

  document.querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model").forEach((card) => {
    if (card.style.display === "none") return;

    let uploadTs = null;
    let viewEl = null;

    card.querySelectorAll("span, div, yt-formatted-string").forEach((el) => {
      if (el.children.length > 0) return;
      const orig = el.dataset.originalDate || el.textContent.trim();
      const parsed = parseVideoUploadTimestamp(orig);
      if (parsed) uploadTs = parsed;
      else if (/^[\d,.]+\s*[KMB]?(\s*views)?$/i.test(orig) && !orig.includes(":")) {
        viewEl = el;
      }
    });

    if (uploadTs && viewEl && !viewEl.dataset.tmViewsDone) {
      const origViews = viewEl.textContent.trim();
      const estViews = estimateVirtualViews(origViews, uploadTs, virtualNow);
      if (estViews) {
        viewEl.dataset.tmViewsDone = "true";
        makeDateToggleable(viewEl, estViews, `Actual: ${origViews}`);
      }
    }
  });
}, 1000);


// === FULL GRID PACKER + VIRTUAL ALGORITHM ===

// 1. Pack remaining old videos tightly together (no white gaps!)
const gridFixStyle = document.createElement("style");
gridFixStyle.textContent = `
  ytd-rich-grid-row, ytd-rich-grid-row #contents {
    display: contents !important;
  }
  ytd-rich-grid-renderer #contents {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 16px !important;
    padding: 16px !important;
  }
  ytd-rich-item-renderer {
    width: 310px !important;
    margin: 0 !important;
  }
`;
document.head.appendChild(gridFixStyle);

// 2. Format virtual date as YYYY-MM-DD
function getVirtualBeforeDate(virtualNow) {
  const nextDay = new Date(virtualNow + 24 * 60 * 60 * 1000);
  const yyyy = nextDay.getFullYear();
  const mm = String(nextDay.getMonth() + 1).padStart(2, "0");
  const dd = String(nextDay.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// 3. Auto-inject before:YYYY-MM-DD into every YouTube search
function enforceHistoricalSearch(virtualNow) {
  if (!window.location.pathname.startsWith("/results")) return;
  const url = new URL(window.location.href);
  const query = url.searchParams.get("search_query");
  if (!query) return;

  const beforeTag = `before:${getVirtualBeforeDate(virtualNow)}`;
  if (!query.includes("before:")) {
    url.searchParams.set("search_query", `${query} ${beforeTag}`);
    window.location.replace(url.toString());
  }
}

// 4. Learn topics from videos you watch (Minecraft, FNAF, Roblox, etc.)
function learnFromWatchedVideo() {
  if (!window.location.pathname.startsWith("/watch")) return;
  const titleEl = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, #title h1");
  if (!titleEl) return;

  const titleText = titleEl.textContent.trim();
  if (!titleText || titleEl.dataset.tmLearned === titleText) return;
  titleEl.dataset.tmLearned = titleText;

  const stopWords = new Set(["the", "and", "for", "with", "you", "this", "that", "from", "part", "episode", "official", "video", "full", "new", "how", "why", "what"]);
  const words = titleText
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w.toLowerCase()));

  if (words.length === 0) return;
  const topic = words.slice(0, 2).join(" ");

  chrome.storage.local.get(["tmInterests"], (data) => {
    let interests = data.tmInterests || [];
    interests = interests.filter((item) => item.toLowerCase() !== topic.toLowerCase());
    interests.unshift(topic);
    interests = interests.slice(0, 8);
    chrome.storage.local.set({ tmInterests: interests });
  });
}

// 5. Render Recommended Topics Bar & Auto-Fill Sparse Feeds
function renderRecommendedBar(virtualNow) {
  if (window.location.pathname !== "/") {
    const oldBar = document.getElementById("tm-algo-bar");
    if (oldBar) oldBar.remove();
    return;
  }

  chrome.storage.local.get(["tmInterests"], (data) => {
    const interests = data.tmInterests || ["Minecraft", "FNAF", "Roblox", "Funny Moments"];
    const beforeTag = `before:${getVirtualBeforeDate(virtualNow)}`;
    const yearStr = new Date(virtualNow).getFullYear();

    let bar = document.getElementById("tm-algo-bar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "tm-algo-bar";
      bar.style.cssText = "background:#fff;border:1px solid #d3d3d3;padding:10px 14px;margin:12px 24px;font-family:Arial,sans-serif;display:flex;flex-wrap:wrap;align-items:center;gap:8px;z-index:999;";
            const primaryCol = document.querySelector("ytd-browse[page-subtype='home'] #primary, #primary");
      if (primaryCol) {
        primaryCol.prepend(bar);
      } else {
        return;
      }
    }

    bar.innerHTML = `<strong style="color:#cc0000;font-size:13px;">Recommended ${yearStr} Feed:</strong>`;

    interests.forEach((topic) => {
      const btn = document.createElement("button");
      btn.textContent = topic;
      btn.style.cssText = "background:#f1f1f1;border:1px solid #ccc;padding:4px 10px;font-size:12px;cursor:pointer;color:#111;";
      btn.addEventListener("click", () => {
        const fullQuery = encodeURIComponent(topic + " " + beforeTag);
window.location.assign("/results?search_query=" + fullQuery);
 
      });
      bar.appendChild(btn);
    });
  });

  // Trigger YouTube's infinite loader if fewer than 10 old videos are visible
  const visibleCards = Array.from(document.querySelectorAll("ytd-rich-item-renderer")).filter(
    (c) => c.style.display !== "none"
  );
  if (visibleCards.length < 10) {
    const spinner = document.querySelector("ytd-continuation-item-renderer");
    if (spinner) spinner.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

setInterval(() => {
  if (!cachedVirtualStart || !cachedRealStart) return;
  const virtualNow = cachedVirtualStart + (Date.now() - cachedRealStart);

  enforceHistoricalSearch(virtualNow);
  learnFromWatchedVideo();
  renderRecommendedBar(virtualNow);
}, 2000);
// Auto-refresh YouTube tab whenever you set a new time in the popup
chrome.storage.onChanged.addListener((changes) => {
  if (changes.historicalStart && changes.historicalStart.oldValue) {
    window.location.reload();
  }
});
// === SHUFFLE FEED ON REFRESH + RANDOM DISCOVERY ===

// 1. Shuffle visible video cards once per page load so every refresh feels fresh
let hasShuffledFeed = false;
function shuffleVisibleGrid() {
  if (hasShuffledFeed || window.location.pathname !== "/") return;
  const gridContents = document.querySelector("ytd-rich-grid-renderer #contents");
  if (!gridContents) return;

  const cards = Array.from(gridContents.querySelectorAll("ytd-rich-item-renderer")).filter(
    (c) => c.style.display !== "none"
  );

  if (cards.length >= 6) {
    hasShuffledFeed = true;
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      gridContents.appendChild(cards.at(j));
    }
  }
}

setInterval(shuffleVisibleGrid, 1500);

// 2. Add a "Randomize Feed" button to the Recommended Bar
setInterval(() => {
  const bar = document.getElementById("tm-algo-bar");
  if (!bar || document.getElementById("tm-shuffle-btn")) return;

  const shuffleBtn = document.createElement("button");
  shuffleBtn.id = "tm-shuffle-btn";
  shuffleBtn.textContent = "🎲 Random Year Feed";
  shuffleBtn.style.cssText = "background:#cc0000;color:#fff;border:none;padding:4px 10px;font-size:12px;font-weight:bold;cursor:pointer;margin-left:auto;";

  shuffleBtn.addEventListener("click", () => {
    const virtualNow = (cachedVirtualStart && cachedRealStart)
      ? cachedVirtualStart + (Date.now() - cachedRealStart)
      : Date.now();
    const beforeTag = "before:" + getVirtualBeforeDate(virtualNow);

    chrome.storage.local.get(["tmInterests"], (data) => {
      const pool = (data.tmInterests || []).concat([
        "gameplay", "music video", "vlog", "funny", "minecraft", "fnaf", "roblox", "review", "trailer"
      ]);
      const randomTopic = pool.at(Math.floor(Math.random() * pool.length));
      const fullQuery = encodeURIComponent(randomTopic + " " + beforeTag);
      window.location.assign("/results?search_query=" + fullQuery);
    });
  });

  bar.appendChild(shuffleBtn);
}, 1000);


// === FIX BLANK WHITE GAPS & AUTO-FETCH MORE OLD VIDEOS ===
setInterval(() => {
  if (window.location.pathname !== "/") return;

  // 1. Collapse empty grid rows so they never leave blank white gaps
  document.querySelectorAll("ytd-rich-grid-row").forEach((row) => {
    const visibleInRow = Array.from(row.querySelectorAll("ytd-rich-item-renderer")).filter(
      (item) => item.style.display !== "none"
    );
    row.style.display = visibleInRow.length === 0 ? "none" : "";
  });

  // 2. Silently ask YouTube to load more videos if fewer than 16 old videos are showing
  const totalVisible = Array.from(document.querySelectorAll("ytd-rich-item-renderer")).filter(
    (item) => item.style.display !== "none"
  ).length;

  if (totalVisible < 16) {
    const continuation = document.querySelector("ytd-continuation-item-renderer");
    if (continuation) {
      window.dispatchEvent(new Event("scroll"));
    }
  }
}, 1200);
