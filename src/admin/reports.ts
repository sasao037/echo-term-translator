import { escapeHtml } from "../html";
import { REPORT_CATEGORY_LABELS, type Report } from "../types";

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchReports(): Promise<Report[]> {
  const res = await fetch("/api/admin/reports", { credentials: "same-origin" });
  if (!res.ok) throw new Error(`読み込みに失敗しました (${res.status})`);
  return res.json();
}

async function updateReportStatus(id: string, status: Report["status"]): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/reports/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = (await parseJson(res)) as { ok: boolean; error?: string } | null;
  return data ?? { ok: false, error: `${res.status}` };
}

async function deleteReport(id: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/admin/reports/${id}`, { method: "DELETE", credentials: "same-origin" });
  const data = (await parseJson(res)) as { ok: boolean; error?: string } | null;
  return data ?? { ok: false, error: `${res.status}` };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("ja-JP");
}

export function mountReportsEditor(container: HTMLElement) {
  let reports: Report[] = [];
  let statusText = "";
  let statusKind: "ok" | "error" | "" = "";
  let showResolved = false;

  function render() {
    const visible = reports.filter((r) => showResolved || r.status === "open");
    const rows = visible
      .map(
        (r) => `
          <div class="admin-report-card${r.status === "resolved" ? " admin-report-resolved" : ""}" data-id="${r.id}">
            <div class="admin-report-meta">
              <span class="admin-report-pokemon">${escapeHtml(r.pokemonEn)} / ${escapeHtml(r.pokemonJa)}</span>
              <span class="admin-report-category">${escapeHtml(REPORT_CATEGORY_LABELS[r.category] ?? r.category)}</span>
              <span class="admin-report-date">${escapeHtml(formatDate(r.createdAt))}</span>
            </div>
            <p class="admin-report-message">${escapeHtml(r.message)}</p>
            <div class="admin-report-actions">
              <button type="button" class="admin-btn" data-action="toggle-status">${
                r.status === "open" ? "解決済みにする" : "未解決に戻す"
              }</button>
              <button type="button" class="admin-btn" data-action="delete">削除</button>
            </div>
          </div>
        `,
      )
      .join("");

    container.innerHTML = `
      <div class="admin-toolbar">
        <label class="admin-checkbox">
          <input type="checkbox" id="show-resolved" ${showResolved ? "checked" : ""} /> 解決済みも表示
        </label>
        <span class="admin-status admin-status-${statusKind}">${escapeHtml(statusText)}</span>
      </div>
      ${visible.length === 0 ? `<p class="admin-empty">報告はありません。</p>` : `<div class="admin-report-list">${rows}</div>`}
    `;

    container.querySelector<HTMLInputElement>("#show-resolved")!.addEventListener("change", (e) => {
      showResolved = (e.target as HTMLInputElement).checked;
      render();
    });
  }

  container.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;
    const card = target.closest<HTMLDivElement>(".admin-report-card")!;
    const id = card.dataset.id!;
    const report = reports.find((r) => r.id === id);
    if (!report) return;

    if (action === "toggle-status") {
      const nextStatus = report.status === "open" ? "resolved" : "open";
      const result = await updateReportStatus(id, nextStatus);
      if (result.ok) report.status = nextStatus;
      else {
        statusText = `更新に失敗しました: ${result.error}`;
        statusKind = "error";
      }
      render();
    } else if (action === "delete") {
      if (!confirm("この報告を削除しますか？")) return;
      const result = await deleteReport(id);
      if (result.ok) reports = reports.filter((r) => r.id !== id);
      else {
        statusText = `削除に失敗しました: ${result.error}`;
        statusKind = "error";
      }
      render();
    }
  });

  (async () => {
    statusText = "読み込み中...";
    render();
    try {
      reports = await fetchReports();
      statusText = `${reports.filter((r) => r.status === "open").length} 件の未解決報告`;
      statusKind = "";
    } catch (err) {
      statusText = (err as Error).message;
      statusKind = "error";
    }
    render();
  })();
}
