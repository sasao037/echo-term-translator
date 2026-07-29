import { escapeHtml } from "../html";
import { renderGuideBody } from "../guide";
import type { GuideSection } from "../types";
import { getData, putData } from "./api";

export function mountGuideEditor(container: HTMLElement) {
  let sections: GuideSection[] = [];
  let statusText = "";
  let statusKind: "ok" | "error" | "" = "";

  function renderCard(section: GuideSection, index: number): string {
    return `
      <div class="admin-card" data-index="${index}">
        <div class="admin-card-toolbar">
          <span class="admin-field">
            id
            <input class="admin-id-input" data-field="id" type="text" value="${escapeHtml(section.id)}" />
          </span>
          <button type="button" class="admin-btn" data-action="up">↑</button>
          <button type="button" class="admin-btn" data-action="down">↓</button>
          <button type="button" class="admin-btn" data-action="delete">削除</button>
        </div>
        <label class="admin-field">
          titleJa
          <input data-field="titleJa" type="text" value="${escapeHtml(section.titleJa)}" />
        </label>
        <label class="admin-field">
          titleEn
          <input data-field="titleEn" type="text" value="${escapeHtml(section.titleEn)}" />
        </label>
        <label class="admin-field admin-field-wide">
          body（■見出し／- 箇条書き／|テーブル|／**太字**・*斜体*）
          <textarea data-field="body">${escapeHtml(section.body)}</textarea>
        </label>
        <div class="admin-preview">
          <p class="admin-preview-label">プレビュー</p>
          <div class="guide-body" data-preview>${renderGuideBody(section.body)}</div>
        </div>
      </div>
    `;
  }

  function render() {
    const toolbar = `
      <div class="admin-toolbar">
        <button type="button" class="admin-btn" data-action="add">＋ セクション追加</button>
        <button type="button" class="admin-btn admin-btn-primary" data-action="save">保存</button>
        <span class="admin-status admin-status-${statusKind}">${escapeHtml(statusText)}</span>
      </div>
    `;
    const list =
      sections.length === 0
        ? `<p class="admin-empty">セクションがありません。「セクション追加」から作成してください。</p>`
        : `<div class="admin-section-list">${sections.map(renderCard).join("")}</div>`;
    container.innerHTML = toolbar + list;
  }

  function getCardIndex(el: HTMLElement): number {
    return Number(el.closest<HTMLDivElement>(".admin-card")!.dataset.index);
  }

  container.addEventListener("input", (e) => {
    const target = e.target as HTMLElement;
    const field = target.dataset.field as keyof GuideSection | undefined;
    if (!field) return;
    const index = getCardIndex(target);
    const value = (target as HTMLInputElement | HTMLTextAreaElement).value;
    sections[index] = { ...sections[index], [field]: value };

    if (field === "body") {
      const card = target.closest<HTMLDivElement>(".admin-card")!;
      card.querySelector<HTMLDivElement>("[data-preview]")!.innerHTML = renderGuideBody(value);
    }
  });

  container.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;

    if (action === "add") {
      let n = sections.length + 1;
      while (sections.some((s) => s.id === `section_${n}`)) n++;
      sections.push({ id: `section_${n}`, titleEn: "", titleJa: "新しいセクション", body: "" });
      render();
      return;
    }

    if (action === "save") {
      const ids = sections.map((s) => s.id.trim());
      if (ids.some((id) => !id)) {
        statusText = "id が空のセクションがあります。";
        statusKind = "error";
        render();
        return;
      }
      if (new Set(ids).size !== ids.length) {
        statusText = "id が重複しています。";
        statusKind = "error";
        render();
        return;
      }
      statusText = "保存中...";
      statusKind = "";
      render();
      const result = await putData("guide", sections);
      statusText = result.ok ? "保存しました。" : `保存に失敗しました: ${result.error}`;
      statusKind = result.ok ? "ok" : "error";
      render();
      return;
    }

    const index = getCardIndex(target);
    if (action === "delete") {
      if (!confirm(`「${sections[index].titleJa || sections[index].id}」を削除しますか？`)) return;
      sections.splice(index, 1);
    } else if (action === "up" && index > 0) {
      [sections[index - 1], sections[index]] = [sections[index], sections[index - 1]];
    } else if (action === "down" && index < sections.length - 1) {
      [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
    }
    render();
  });

  (async () => {
    statusText = "読み込み中...";
    render();
    try {
      sections = await getData<GuideSection[]>("guide");
      statusText = `${sections.length} セクション`;
      statusKind = "";
    } catch (err) {
      statusText = (err as Error).message;
      statusKind = "error";
    }
    render();
  })();
}
