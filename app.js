const state = { page: 1, pages: 1, total: 0, loading: false, projects: [], filtered: [] };
const detailCache = new Map();
const $ = (id) => document.getElementById(id);
const filterIds = ["year", "scheme", "institution", "panel", "subject", "status"];
const labels = { year: "Year", scheme: "Scheme", institution: "Institution", panel: "Panel", subject: "Subject", status: "Status" };
const nf = new Intl.NumberFormat("en-HK");

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function normalize(value = "") {
  return String(value).normalize("NFKC").toLocaleLowerCase("en-HK");
}

function optionMarkup(items) {
  return items.map(item => `<option value="${esc(item.value)}">${esc(item.value)} (${nf.format(item.count)})</option>`).join("");
}

function countsFor(field) {
  const counts = new Map();
  state.projects.forEach(item => {
    const value = item[field];
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true }));
}

function loadFilters() {
  const fields = { year: "award_year", scheme: "funding_scheme", institution: "institution", panel: "panel", subject: "subject_area", status: "status" };
  filterIds.forEach(id => $(id).insertAdjacentHTML("beforeend", optionMarkup(countsFor(fields[id]))));
}

function loadStats(meta) {
  $("statTotal").textContent = nf.format(meta.source_total);
  $("statComplete").textContent = nf.format(meta.complete);
  $("statYears").textContent = nf.format(meta.years);
  $("statInstitutions").textContent = nf.format(meta.institutions);
  $("captureNote").textContent = `Snapshot captured ${meta.captured_at} · Complete · Contact fields removed`;
}

function renderActiveFilters() {
  const chips = [];
  if ($("search").value.trim()) chips.push(`<span class="chip">Search: ${esc($("search").value.trim())}</span>`);
  filterIds.forEach(id => { if ($(id).value) chips.push(`<span class="chip">${labels[id]}: ${esc($(id).value)}</span>`); });
  $("activeFilters").innerHTML = chips.join("");
}

function row(item) {
  return `<tr>
    <td><span class="project-number">${esc(item.project_number)}</span><button class="project-link" data-project="${esc(item.project_number)}">${esc(item.title || "Untitled project")}</button><div class="secondary">${esc(item.funding_scheme)}</div></td>
    <td>${esc(item.principal_investigator || "—")}</td>
    <td>${esc(item.institution || "—")}<div class="secondary">${esc([item.panel,item.subject_area].filter(Boolean).join(" · "))}</div></td>
    <td>${esc(item.award_year || "—")}</td><td>${item.fund_approved ? `HK$ ${esc(item.fund_approved)}` : "—"}</td>
    <td><span class="status">${esc(item.status || "—")}</span></td>
  </tr>`;
}

function card(item) {
  return `<article class="card"><span class="project-number">${esc(item.project_number)}</span><button class="project-link" data-project="${esc(item.project_number)}">${esc(item.title || "Untitled project")}</button><div class="secondary">${esc(item.principal_investigator)}</div><div class="card-meta"><span>${esc(item.award_year || "Year —")}</span><span>${esc(item.status || "Status —")}</span><span>${esc(item.institution || "Institution pending")}</span><span>${item.fund_approved ? `HK$ ${esc(item.fund_approved)}` : "Fund —"}</span></div></article>`;
}

function fundValue(value) {
  return Number(String(value || "0").replace(/[^0-9.]/g, "")) || 0;
}

function compareItems(a, b) {
  const sort = $("sort").value;
  if (sort === "year_asc") return a.award_year.localeCompare(b.award_year) || a.project_number.localeCompare(b.project_number);
  if (sort === "title") return a.title.localeCompare(b.title) || a.project_number.localeCompare(b.project_number);
  if (sort === "investigator") return a.principal_investigator.localeCompare(b.principal_investigator) || a.project_number.localeCompare(b.project_number);
  if (sort === "fund_desc") return fundValue(b.fund_approved) - fundValue(a.fund_approved) || a.project_number.localeCompare(b.project_number);
  if (sort === "project_number") return a.project_number.localeCompare(b.project_number, undefined, { numeric: true });
  return b.award_year.localeCompare(a.award_year) || a.project_number.localeCompare(b.project_number);
}

function loadProjects() {
  const query = normalize($("search").value.trim());
  const fields = { year: "award_year", scheme: "funding_scheme", institution: "institution", panel: "panel", subject: "subject_area", status: "status" };
  state.filtered = state.projects.filter(item => {
    if (query && !item.search.includes(query)) return false;
    return filterIds.every(id => !$(id).value || item[fields[id]] === $(id).value);
  }).sort(compareItems);

  const perPage = Number($("perPage").value);
  state.total = state.filtered.length;
  state.pages = Math.max(1, Math.ceil(state.total / perPage));
  state.page = Math.min(state.page, state.pages);
  const items = state.filtered.slice((state.page - 1) * perPage, state.page * perPage);
  $("resultCount").textContent = `${nf.format(state.total)} project${state.total === 1 ? "" : "s"}`;
  $("projectRows").innerHTML = items.length ? items.map(row).join("") : `<tr><td colspan="6" class="empty">No projects match these filters.</td></tr>`;
  $("projectCards").innerHTML = items.length ? items.map(card).join("") : `<div class="empty">No projects match these filters.</div>`;
  $("pageLabel").textContent = `Page ${nf.format(state.page)} of ${nf.format(state.pages)}`;
  $("prevPage").disabled = state.page <= 1;
  $("nextPage").disabled = state.page >= state.pages;
  renderActiveFilters();
}

function detailSection(section) {
  if (!section.value && !section.rows?.length) return "";
  let table = "";
  if (section.rows?.length) table = `<div class="table-wrap"><table class="nested-table"><tbody>${section.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  return `<section class="detail-section"><h3>${esc(section.label)}</h3>${section.value ? `<p>${esc(section.value)}</p>` : ""}${table}</section>`;
}

async function getShard(name) {
  if (!detailCache.has(name)) {
    const promise = fetch(`./data/projects/${encodeURIComponent(name)}.json`).then(response => {
      if (!response.ok) throw new Error(`Could not load detail file (${response.status})`);
      return response.json();
    });
    detailCache.set(name, promise);
  }
  return detailCache.get(name);
}

async function openProject(projectNumber) {
  const dialog = $("projectDialog");
  const item = state.projects.find(project => project.project_number === projectNumber);
  if (!item) return;
  $("projectDetail").innerHTML = `<div class="loading">Loading project details…</div>`;
  dialog.showModal();
  try {
    const shard = await getShard(item.shard);
    const sections = shard[projectNumber] || [];
    const basics = [
      ["Funding scheme", item.funding_scheme], ["Institution", item.institution], ["Department", item.department],
      ["Panel", item.panel], ["Subject area", item.subject_area], ["Award year", item.award_year],
      ["Approved fund", item.fund_approved ? `HK$ ${item.fund_approved}` : ""], ["Completion date", item.completion_date]
    ].filter(([,value]) => value);
    $("projectDetail").innerHTML = `<header class="detail-header"><p class="eyebrow">Project ${esc(item.project_number)}</p><h2>${esc(item.title)}</h2><div class="detail-meta"><span>${esc(item.principal_investigator)}</span><span class="status">${esc(item.status)}</span></div></header>
      <dl class="detail-grid">${basics.map(([key,value]) => `<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>
      ${sections.map(detailSection).join("")}
      ${item.source_url ? `<p><a class="source-link" href="${esc(item.source_url)}" target="_blank" rel="noreferrer">Open original RGC record</a></p>` : ""}`;
  } catch (error) {
    $("projectDetail").innerHTML = `<div class="empty">The detailed record could not be loaded. Please check your connection and try again.</div>`;
  }
}

function unpackCatalog(payload) {
  return payload.projects.map(values => {
    const item = Object.fromEntries(payload.fields.map((field, index) => [field, values[index] ?? ""]));
    item.search = normalize([
      item.project_number, item.title, item.principal_investigator, item.department,
      item.institution, item.funding_scheme, item.panel, item.subject_area, item.award_year,
      item.status
    ].join(" "));
    return item;
  });
}

let searchTimer;
$("search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.page = 1; loadProjects(); }, 180); });
[...filterIds, "sort", "perPage"].forEach(id => $(id).addEventListener("change", () => { state.page = 1; loadProjects(); }));
$("clearFilters").addEventListener("click", () => { $("search").value = ""; filterIds.forEach(id => $(id).value = ""); state.page = 1; loadProjects(); });
$("prevPage").addEventListener("click", () => { if (state.page > 1) { state.page--; loadProjects(); scrollTo({top:0,behavior:"smooth"}); } });
$("nextPage").addEventListener("click", () => { if (state.page < state.pages) { state.page++; loadProjects(); scrollTo({top:0,behavior:"smooth"}); } });
document.addEventListener("click", event => { const button = event.target.closest("[data-project]"); if (button) openProject(button.dataset.project); });
$("closeDialog").addEventListener("click", () => $("projectDialog").close());
$("projectDialog").addEventListener("click", event => { if (event.target === $("projectDialog")) $("projectDialog").close(); });

async function start() {
  try {
    const response = await fetch("./data/catalog.json");
    if (!response.ok) throw new Error(`Could not load catalogue (${response.status})`);
    const payload = await response.json();
    state.projects = unpackCatalog(payload);
    loadStats(payload.meta);
    loadFilters();
    loadProjects();
  } catch (error) {
    $("projectRows").innerHTML = `<tr><td colspan="6" class="empty">The public catalogue could not be loaded. Please refresh the page.</td></tr>`;
    $("resultCount").textContent = "Catalogue unavailable";
  }
}

start();
