import "./style.css";
import { loadGuide, renderGuideBody } from "./guide";
import { escapeHtml } from "./html";
import { addHistoryEntry, clearHistory, loadHistory } from "./history";
import { getPokemonDetail } from "./pokemon-detail";
import { loadIndex, search } from "./search";
import { typeColor } from "./type-colors";
import { CATEGORY_LABELS, type PokemonDetail, type SearchResult } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="page">
    <header class="header">
      <h1>Pokémon Echo 用語辞典</h1>
      <p class="subtitle">英語 ⇔ 日本語 用語検索（地名・用語）＋ 攻略情報</p>
    </header>

    <nav class="tabs">
      <button type="button" id="tab-search" class="tab tab-active">検索</button>
      <button type="button" id="tab-guide" class="tab">攻略情報</button>
    </nav>

    <main class="main" id="panel-search">
      <input
        id="search-input"
        class="search-input"
        type="search"
        placeholder="英語または日本語で入力（例: City / シティ）"
        autocomplete="off"
        disabled
      />
      <div id="history" class="history"></div>
      <p id="status" class="status">データを読み込み中...</p>
      <ul id="results" class="results"></ul>
    </main>

    <main class="main" id="panel-guide" hidden>
      <p id="guide-status" class="status">読み込み中...</p>
      <div id="guide-list" class="guide-list"></div>
    </main>

    <footer class="footer">
      <p>
        本サイトは個人が制作した非公式のファンメイドツールです。
        ファンメイド作品「Pokémon Echo」の制作者、および
        株式会社ポケモン・任天堂・Game Freak とは一切関係ありません。
        掲載データは有志による調査・翻訳に基づいています。
      </p>
    </footer>
  </div>

  <div id="pokemon-modal" class="modal-overlay" hidden>
    <div class="modal-card" role="dialog" aria-modal="true">
      <button type="button" id="modal-close" class="modal-close" aria-label="閉じる">×</button>
      <div id="modal-body" class="modal-body"></div>
    </div>
  </div>
`;

const tabSearch = document.querySelector<HTMLButtonElement>("#tab-search")!;
const tabGuide = document.querySelector<HTMLButtonElement>("#tab-guide")!;
const panelSearch = document.querySelector<HTMLDivElement>("#panel-search")!;
const panelGuide = document.querySelector<HTMLDivElement>("#panel-guide")!;

function activateTab(tab: "search" | "guide") {
  const isSearch = tab === "search";
  panelSearch.hidden = !isSearch;
  panelGuide.hidden = isSearch;
  tabSearch.classList.toggle("tab-active", isSearch);
  tabGuide.classList.toggle("tab-active", !isSearch);
}

tabSearch.addEventListener("click", () => activateTab("search"));
tabGuide.addEventListener("click", () => activateTab("guide"));

const input = document.querySelector<HTMLInputElement>("#search-input")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const resultsEl = document.querySelector<HTMLUListElement>("#results")!;
const historyEl = document.querySelector<HTMLDivElement>("#history")!;

let history = loadHistory();

function renderHistory() {
  if (input.value.trim() || history.length === 0) {
    historyEl.innerHTML = "";
    return;
  }

  historyEl.innerHTML = `
    <div class="history-header">
      <span class="history-label">最近の検索</span>
      <button type="button" id="history-clear" class="history-clear">履歴を削除</button>
    </div>
    <ul class="history-list">
      ${history
        .map(
          (q) =>
            `<li><button type="button" class="history-item">${escapeHtml(q)}</button></li>`,
        )
        .join("")}
    </ul>
  `;
}

historyEl.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;

  if (target.id === "history-clear") {
    history = clearHistory();
    renderHistory();
    return;
  }

  if (target.classList.contains("history-item")) {
    const q = target.textContent ?? "";
    input.value = q;
    input.dispatchEvent(new Event("input"));
    input.focus();
  }
});

let lastPokemonResults = new Map<number, SearchResult>();

function renderResults(results: SearchResult[], query: string) {
  if (!query.trim()) {
    resultsEl.innerHTML = "";
    statusEl.textContent = "";
    statusEl.hidden = false;
    return;
  }

  if (results.length === 0) {
    resultsEl.innerHTML = "";
    statusEl.textContent = "該当する用語が見つかりませんでした。";
    statusEl.hidden = false;
    return;
  }

  lastPokemonResults = new Map(
    results.filter((r) => r.category === "pokemon").map((r) => [r.id, r]),
  );

  statusEl.hidden = true;
  resultsEl.innerHTML = results
    .map((r) => {
      const clickable = r.category === "pokemon";
      return `
        <li class="result-item${clickable ? " result-item-clickable" : ""}"${
          clickable ? ` data-pokemon-id="${r.id}"` : ""
        }>
          <span class="badge badge-${r.category}">${CATEGORY_LABELS[r.category]}</span>
          <span class="term-en">${escapeHtml(r.en)}</span>
          <span class="term-arrow">→</span>
          <span class="term-ja">${escapeHtml(r.ja)}</span>
        </li>
      `;
    })
    .join("");
}

const STAT_LABELS: Record<keyof PokemonDetail["stats"], string> = {
  hp: "HP",
  attack: "こうげき",
  defense: "ぼうぎょ",
  specialAttack: "とくこう",
  specialDefense: "とくぼう",
  speed: "すばやさ",
};
const STAT_MAX = 200;

function renderPokemonBody(en: string, ja: string, detail: PokemonDetail | undefined): string {
  const title = `
    <h2 class="modal-title">
      <span class="term-en">${escapeHtml(en)}</span>
      <span class="term-arrow">→</span>
      <span class="term-ja">${escapeHtml(ja)}</span>
    </h2>
  `;

  if (!detail) {
    return `${title}<p class="status">読み込み中...</p>`;
  }

  const types = detail.types
    .map(
      (t) =>
        `<span class="type-badge" style="background:${typeColor(t.en)}">${escapeHtml(t.ja)}</span>`,
    )
    .join("");

  const stats = (Object.keys(STAT_LABELS) as (keyof PokemonDetail["stats"])[])
    .map((key) => {
      const value = detail.stats[key];
      const pct = Math.min(100, Math.round((value / STAT_MAX) * 100));
      return `
        <div class="stat-row">
          <span class="stat-label">${STAT_LABELS[key]}</span>
          <span class="stat-bar-track"><span class="stat-bar-fill" style="width:${pct}%"></span></span>
          <span class="stat-value">${value}</span>
        </div>
      `;
    })
    .join("");

  const abilities = detail.abilities
    .map(
      (a) =>
        `<span class="ability-chip${a.isHidden ? " ability-chip-hidden" : ""}">${escapeHtml(a.ja)}${
          a.isHidden ? "（隠れ特性）" : ""
        }</span>`,
    )
    .join("");

  const moves = detail.moves
    .map(
      (m) => `
        <tr>
          <td>${m.level === 0 ? "-" : `Lv.${m.level}`}</td>
          <td>${escapeHtml(m.ja)}</td>
          <td>${escapeHtml(m.en)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    ${title}
    <div class="modal-section">
      <div class="type-badges">${types}</div>
    </div>
    <div class="modal-section">
      <h3 class="modal-section-title">種族値</h3>
      <div class="stat-list">${stats}</div>
    </div>
    <div class="modal-section">
      <h3 class="modal-section-title">特性</h3>
      <div class="ability-list">${abilities}</div>
    </div>
    <div class="modal-section">
      <h3 class="modal-section-title">レベルアップで覚える技</h3>
      <table class="move-table">
        <thead><tr><th>Lv</th><th>技名</th><th>English</th></tr></thead>
        <tbody>${moves}</tbody>
      </table>
    </div>
  `;
}

const pokemonModal = document.querySelector<HTMLDivElement>("#pokemon-modal")!;
const modalBody = document.querySelector<HTMLDivElement>("#modal-body")!;
const modalClose = document.querySelector<HTMLButtonElement>("#modal-close")!;

function closeModal() {
  pokemonModal.hidden = true;
  modalBody.innerHTML = "";
}

async function openPokemonModal(id: number, en: string, ja: string) {
  pokemonModal.hidden = false;
  modalBody.innerHTML = renderPokemonBody(en, ja, undefined);
  try {
    const detail = await getPokemonDetail(id);
    modalBody.innerHTML = renderPokemonBody(en, ja, detail);
  } catch (err) {
    console.error(err);
    modalBody.innerHTML = `${modalBody.innerHTML}<p class="status">詳細データの読み込みに失敗しました。</p>`;
  }
}

resultsEl.addEventListener("click", (e) => {
  const item = (e.target as HTMLElement).closest<HTMLLIElement>(".result-item-clickable");
  if (!item) return;
  const id = Number(item.dataset.pokemonId);
  const result = lastPokemonResults.get(id);
  if (!result) return;
  openPokemonModal(id, result.en, result.ja);
});

modalClose.addEventListener("click", closeModal);
pokemonModal.addEventListener("click", (e) => {
  if (e.target === pokemonModal) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !pokemonModal.hidden) closeModal();
});

let debounceTimer: number | undefined;

async function initSearch() {
  try {
    const index = await loadIndex();
    input.disabled = false;
    statusEl.textContent = `${index.length.toLocaleString()} 件の用語を検索できます。入力を始めてください。`;

    input.addEventListener("input", () => {
      renderHistory();
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        const results = search(index, input.value);
        renderResults(results, input.value);
      }, 100);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const q = input.value.trim();
      if (!q) return;
      history = addHistoryEntry(q);
    });

    renderHistory();
    input.focus();
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "データの読み込みに失敗しました。ページを再読み込みしてください。";
  }
}

const guideStatusEl = document.querySelector<HTMLParagraphElement>("#guide-status")!;
const guideListEl = document.querySelector<HTMLDivElement>("#guide-list")!;

async function initGuide() {
  try {
    const sections = await loadGuide();
    guideStatusEl.hidden = true;
    guideListEl.innerHTML = sections
      .map(
        (s) => `
          <details class="guide-section">
            <summary class="guide-title">${escapeHtml(s.titleJa)}</summary>
            <div class="guide-body">${renderGuideBody(s.body)}</div>
          </details>
        `,
      )
      .join("");
  } catch (err) {
    console.error(err);
    guideStatusEl.textContent =
      "攻略情報の読み込みに失敗しました。ページを再読み込みしてください。";
  }
}

initSearch();
initGuide();
