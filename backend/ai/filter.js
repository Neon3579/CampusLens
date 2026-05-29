const MAX_RESULTS = 8;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function noticeMatches(notice, spec, today) {
  if (spec.category && spec.category !== "전체" && notice.category !== spec.category) return false;
  if (spec.urgent === true && !notice.urgent) return false;
  if (spec.urgent === false && notice.urgent) return false;
  if (typeof spec.deadlineWithinDays === "number") {
    if (!notice.deadline) return false;
    const dl = startOfDay(notice.deadline);
    if (Number.isNaN(dl.getTime())) return false;
    const from = startOfDay(today);
    const to = startOfDay(today);
    to.setDate(to.getDate() + spec.deadlineWithinDays);
    if (dl < from || dl > to) return false;
  }
  return true;
}

function keywordScore(text, keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (kw && lower.includes(String(kw).toLowerCase())) score += 1;
  }
  return score;
}

function noticeSource(n) {
  return { type: "notice", id: n.id, title: n.title, dept: n.dept,
    date: n.date, deadline: n.deadline, url: n.url };
}

function restaurantSource(r) {
  return { type: "restaurant", id: r.id, name: r.name, desc: r.desc, icon: r.icon };
}

export function filterSources(spec = {}, notices = [], restaurants = [], today = new Date()) {
  const dataset = spec.dataset === "restaurants" ? "restaurants"
    : spec.dataset === "both" ? "both" : "notices";
  const hasKw = Array.isArray(spec.keywords) && spec.keywords.length > 0;
  const scored = [];

  if (dataset === "notices" || dataset === "both") {
    for (const n of notices) {
      if (!noticeMatches(n, spec, today)) continue;
      const text = [n.title, n.summary, (n.tags || []).join(" ")].join(" ");
      const score = keywordScore(text, spec.keywords);
      if (hasKw && score === 0) continue;
      scored.push({ score: score + (n.urgent ? 0.5 : 0), src: noticeSource(n) });
    }
  }

  if (dataset === "restaurants" || dataset === "both") {
    for (const r of restaurants) {
      const menus = Object.values(r.weeklyMeals || {}).flat()
        .map((m) => `${m.menu || ""} ${m.desc || ""}`).join(" ");
      const text = [r.name, r.desc, menus].join(" ");
      const score = keywordScore(text, spec.keywords);
      if (hasKw && score === 0) continue;
      scored.push({ score, src: restaurantSource(r) });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS).map((s) => s.src);
}
