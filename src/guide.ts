import { escapeHtml } from "./html";
import type { GuideSection } from "./types";

let sections: GuideSection[] | null = null;

export async function loadGuide(): Promise<GuideSection[]> {
  if (sections) return sections;

  const res = await fetch("/api/data/guide");
  if (!res.ok) {
    throw new Error(`Failed to load guide data: ${res.status}`);
  }
  sections = await res.json();
  return sections!;
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function renderTable(lines: string[]): string {
  const rows = lines.map((line) => {
    const cells = line.split("|").map((c) => c.trim());
    if (cells[0] === "") cells.shift();
    if (cells[cells.length - 1] === "") cells.pop();
    return cells;
  });

  const [head, ...body] = rows;
  const theadHtml = `<tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`;
  const tbodyHtml = body
    .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
    .join("");

  return `<table class="guide-table"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table>`;
}

function renderList(lines: string[]): string {
  const items = lines.map((line) => {
    const m = line.match(/^( *)-\s+(.*)$/);
    const indent = m ? m[1].length : 0;
    const text = m ? inline(m[2]) : inline(line);
    return { deep: indent >= 4, text };
  });

  let html = "<ul>";
  let inSub = false;
  for (const item of items) {
    if (item.deep && !inSub) {
      html = html.endsWith("</li>") ? html.slice(0, -"</li>".length) : html;
      html += "<ul>";
      inSub = true;
    } else if (!item.deep && inSub) {
      html += "</ul></li>";
      inSub = false;
    }
    html += `<li>${item.text}</li>`;
  }
  if (inSub) html += "</ul></li>";
  html += "</ul>";

  return html;
}

function renderBlock(lines: string[]): string {
  if (lines.length === 0) return "";

  if (lines[0].startsWith("■")) {
    const heading = lines[0].slice("■".length);
    const rest = lines.slice(1);
    return `<h4>${inline(heading)}</h4>${renderBlock(rest)}`;
  }

  if (lines[0].startsWith("|")) {
    return renderTable(lines);
  }

  if (lines.every((l) => /^\s*-\s+/.test(l))) {
    return renderList(lines);
  }

  return `<p>${lines.map(inline).join("<br>")}</p>`;
}

export function renderGuideBody(raw: string): string {
  const escaped = escapeHtml(raw);
  const blocks = escaped.split(/\n\n+/);
  return blocks.map((block) => renderBlock(block.split("\n"))).join("");
}
