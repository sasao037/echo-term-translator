import { escapeHtml } from "../html";
import type { TermEntry } from "../types";
import { getData, putData, type DataName } from "./api";

export function mountSimpleListEditor(container: HTMLElement, name: DataName, label: string) {
  let entries: TermEntry[] = [];
  let statusText = "";
  let statusKind: "ok" | "error" | "" = "";

  function render() {
    container.innerHTML = `
      <div class="admin-toolbar">
        <button type="button" class="admin-btn" data-action="add">＋ 追加</button>
        <button type="button" class="admin-btn admin-btn-primary" data-action="save">保存</button>
        <span class="admin-status admin-status-${statusKind}">${escapeHtml(statusText)}</span>
      </div>
      <table class="admin-table">
        <thead><tr><th class="admin-col-id">ID</th><th>English</th><th>日本語</th><th></th></tr></thead>
        <tbody>
          ${entries
            .map(
              (e, i) => `
                <tr data-index="${i}">
                  <td><input class="admin-col-id" data-field="id" type="number" value="${e.id}" /></td>
                  <td><input data-field="en" type="text" value="${escapeHtml(e.en)}" /></td>
                  <td><input data-field="ja" type="text" value="${escapeHtml(e.ja)}" /></td>
                  <td><button type="button" class="admin-btn" data-action="delete">削除</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
      ${entries.length === 0 ? `<p class="admin-empty">${escapeHtml(label)} のデータがありません。</p>` : ""}
    `;
  }

  container.addEventListener("input", (e) => {
    const target = e.target as HTMLInputElement;
    const field = target.dataset.field as keyof TermEntry | undefined;
    if (!field) return;
    const row = target.closest<HTMLTableRowElement>("tr[data-index]");
    if (!row) return;
    const index = Number(row.dataset.index);
    const value = field === "id" ? Number(target.value) : target.value;
    entries[index] = { ...entries[index], [field]: value } as TermEntry;
  });

  container.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (action === "delete") {
      const row = target.closest<HTMLTableRowElement>("tr[data-index]")!;
      entries.splice(Number(row.dataset.index), 1);
      render();
    } else if (action === "add") {
      const nextId = entries.length === 0 ? 1 : Math.max(...entries.map((e) => e.id)) + 1;
      entries.push({ id: nextId, en: "", ja: "" });
      render();
    } else if (action === "save") {
      const ids = entries.map((e) => e.id);
      if (new Set(ids).size !== ids.length) {
        statusText = "IDが重複しています。";
        statusKind = "error";
        render();
        return;
      }
      statusText = "保存中...";
      statusKind = "";
      render();
      const result = await putData(name, entries);
      statusText = result.ok ? "保存しました。" : `保存に失敗しました: ${result.error}`;
      statusKind = result.ok ? "ok" : "error";
      render();
    }
  });

  (async () => {
    statusText = "読み込み中...";
    render();
    try {
      entries = await getData<TermEntry[]>(name);
      statusText = `${entries.length} 件`;
      statusKind = "";
    } catch (err) {
      statusText = (err as Error).message;
      statusKind = "error";
    }
    render();
  })();
}
