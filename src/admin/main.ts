import "../style.css";
import { checkSession, login, logout } from "./api";
import { mountGuideEditor } from "./guide";
import { mountPokemonDetailEditor } from "./pokemon-detail";
import { mountSimpleListEditor } from "./simple-list";

const app = document.querySelector<HTMLDivElement>("#admin-app")!;

type Tab = { key: string; label: string; mount: (el: HTMLElement) => void };

const TABS: Tab[] = [
  { key: "guide", label: "攻略情報", mount: mountGuideEditor },
  { key: "towns", label: "地名", mount: (el) => mountSimpleListEditor(el, "towns", "地名") },
  { key: "terms", label: "用語", mount: (el) => mountSimpleListEditor(el, "terms", "用語") },
  { key: "items", label: "どうぐ", mount: (el) => mountSimpleListEditor(el, "items", "どうぐ") },
  { key: "pokemon", label: "ポケモン名", mount: (el) => mountSimpleListEditor(el, "pokemon", "ポケモン名") },
  { key: "pokemon-detail", label: "ポケモン詳細", mount: mountPokemonDetailEditor },
];

function renderLogin(error?: string) {
  app.innerHTML = `
    <div class="admin-login">
      <form id="login-form" class="admin-login-card">
        <h1>管理画面ログイン</h1>
        <label class="admin-field">
          パスワード
          <input id="login-password" type="password" autocomplete="current-password" autofocus />
        </label>
        <button type="submit" class="admin-btn admin-btn-primary">ログイン</button>
        ${error ? `<p class="admin-status admin-status-error">${error}</p>` : ""}
      </form>
    </div>
  `;

  const form = document.querySelector<HTMLFormElement>("#login-form")!;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.querySelector<HTMLInputElement>("#login-password")!.value;
    const result = await login(password);
    if (result.ok) renderDashboard();
    else renderLogin(result.error ?? "ログインに失敗しました。");
  });
}

let activeTab = TABS[0].key;

function renderDashboard() {
  app.innerHTML = `
    <div class="admin-page">
      <div class="admin-header">
        <h1>管理画面</h1>
        <button type="button" id="logout-btn" class="admin-btn">ログアウト</button>
      </div>
      <nav class="admin-tabs">
        ${TABS.map((t) => `<button type="button" class="admin-tab${t.key === activeTab ? " admin-tab-active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("")}
      </nav>
      <div id="tab-content" class="admin-tab-content"></div>
    </div>
  `;

  document.querySelector<HTMLButtonElement>("#logout-btn")!.addEventListener("click", async () => {
    await logout();
    renderLogin();
  });

  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab!;
      renderDashboard();
    });
  });

  const content = document.querySelector<HTMLDivElement>("#tab-content")!;
  const tab = TABS.find((t) => t.key === activeTab)!;
  tab.mount(content);
}

(async () => {
  const authed = await checkSession();
  if (authed) renderDashboard();
  else renderLogin();
})();
