import { escapeHtml } from "./html";
import { renderGuideBody } from "./guide";
import type { GuideSection } from "./types";

const app = document.querySelector<HTMLDivElement>("#editor-app")!;

app.innerHTML = `
  <div class="editor-page">
    <div class="editor-header">
      <h1>攻略情報エディタ（開発用・ローカル専用）</h1>
      <div class="editor-actions">
        <button type="button" id="btn-reload" class="editor-btn">再読み込み</button>
        <button type="button" id="btn-add" class="editor-btn">セクション追加</button>
        <button type="button" id="btn-save" class="editor-btn editor-btn-primary">保存</button>
      </div>
    </div>
    <p id="status" class="editor-status"></p>
    <div id="list" class="editor-section-list"></div>
  </div>
`;

const listEl = document.querySelector<HTMLDivElement>("#list")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;

let sections: GuideSection[] = [];

function setStatus(text: string, kind?: "ok" | "error") {
  statusEl.textContent = text;
  statusEl.className = `editor-status${kind ? ` editor-status-${kind}` : ""}`;
}

function renderCard(section: GuideSection, index: number): string {
  return `
    <div class="editor-card" data-index="${index}">
      <div class="editor-card-toolbar">
        <span class="editor-field">
          id
          <input class="editor-id-input" data-field="id" type="text" value="${escapeHtml(section.id)}" />
        </span>
        <button type="button" class="editor-btn" data-action="up">↑</button>
        <button type="button" class="editor-btn" data-action="down">↓</button>
        <button type="button" class="editor-btn" data-action="delete">削除</button>
      </div>
      <label class="editor-field">
        titleJa
        <input data-field="titleJa" type="text" value="${escapeHtml(section.titleJa)}" />
      </label>
      <label class="editor-field">
        titleEn
        <input data-field="titleEn" type="text" value="${escapeHtml(section.titleEn)}" />
      </label>
      <label class="editor-field editor-field-wide">
        body（■見出し／- 箇条書き／\\|テーブル\\|／**太字**・*斜体*）
        <textarea data-field="body">${escapeHtml(section.body)}</textarea>
      </label>
      <div class="editor-preview">
        <p class="editor-preview-label">プレビュー</p>
        <div class="guide-body" data-preview>${renderGuideBody(section.body)}</div>
      </div>
    </div>
  `;
}

function renderList() {
  if (sections.length === 0) {
    listEl.innerHTML = `<p class="editor-empty">セクションがありません。「セクション追加」から作成してください。</p>`;
    return;
  }
  listEl.innerHTML = sections.map(renderCard).join("");
}

function getCardIndex(el: HTMLElement): number {
  const card = el.closest<HTMLDivElement>(".editor-card")!;
  return Number(card.dataset.index);
}

listEl.addEventListener("input", (e) => {
  const target = e.target as HTMLElement;
  const field = target.dataset.field as keyof GuideSection | undefined;
  if (!field) return;
  const index = getCardIndex(target);
  const value = (target as HTMLInputElement | HTMLTextAreaElement).value;
  sections[index] = { ...sections[index], [field]: value };

  if (field === "body") {
    const card = target.closest<HTMLDivElement>(".editor-card")!;
    const preview = card.querySelector<HTMLDivElement>("[data-preview]")!;
    preview.innerHTML = renderGuideBody(value);
  }
});

listEl.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const action = target.dataset.action;
  if (!action) return;
  const index = getCardIndex(target);

  if (action === "delete") {
    if (!confirm(`「${sections[index].titleJa || sections[index].id}」を削除しますか？`)) return;
    sections.splice(index, 1);
  } else if (action === "up" && index > 0) {
    [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
  } else if (action === "down" && index < sections.length - 1) {
    [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
  }
  renderList();
});

document.querySelector<HTMLButtonElement>("#btn-add")!.addEventListener("click", () => {
  let n = sections.length + 1;
  while (sections.some((s) => s.id === `section_${n}`)) n++;
  sections.push({ id: `section_${n}`, titleEn: "", titleJa: "新しいセクション", body: "" });
  renderList();
});

async function loadSections() {
  setStatus("読み込み中...");
  try {
    const res = await fetch(`/data/guide.json?t=${Date.now()}`);
    if (!res.ok) throw new Error(`${res.status}`);
    sections = await res.json();
    renderList();
    setStatus(`${sections.length} セクションを読み込みました。`);
  } catch (err) {
    console.error(err);
    setStatus("guide.json の読み込みに失敗しました。", "error");
  }
}

document.querySelector<HTMLButtonElement>("#btn-reload")!.addEventListener("click", () => {
  if (!confirm("保存していない変更は失われます。再読み込みしますか？")) return;
  loadSections();
});

document.querySelector<HTMLButtonElement>("#btn-save")!.addEventListener("click", async () => {
  const ids = sections.map((s) => s.id.trim());
  if (ids.some((id) => !id)) {
    setStatus("id が空のセクションがあります。", "error");
    return;
  }
  if (new Set(ids).size !== ids.length) {
    setStatus("id が重複しています。", "error");
    return;
  }

  setStatus("保存中...");
  try {
    const res = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sections),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error ?? `${res.status}`);
    setStatus("保存しました。（public/data/guide.json を更新済み。git commit を忘れずに）", "ok");
  } catch (err) {
    console.error(err);
    setStatus(`保存に失敗しました: ${(err as Error).message}`, "error");
  }
});

loadSections();
