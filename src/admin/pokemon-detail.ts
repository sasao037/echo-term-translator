import { escapeHtml } from "../html";
import type { EvolutionRef, PokemonDetail, PokemonStats, TermEntry } from "../types";
import { getData, putData } from "./api";

const STAT_KEYS: (keyof PokemonStats)[] = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];
const STAT_LABELS: Record<keyof PokemonStats, string> = {
  hp: "HP",
  attack: "こうげき",
  defense: "ぼうぎょ",
  specialAttack: "とくこう",
  specialDefense: "とくぼう",
  speed: "すばやさ",
};

function emptyDetail(id: number): PokemonDetail {
  return {
    id,
    types: [],
    stats: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    abilities: [],
    moves: [],
    evolvesFrom: null,
    evolvesTo: [],
  };
}

export function mountPokemonDetailEditor(container: HTMLElement) {
  let pokemonList: TermEntry[] = [];
  let details = new Map<number, PokemonDetail>();
  let selectedId: number | null = null;
  let current: PokemonDetail | null = null;
  let statusText = "";
  let statusKind: "ok" | "error" | "" = "";

  function nameOf(id: number): string {
    const p = pokemonList.find((p) => p.id === id);
    return p ? `${String(p.id).padStart(3, "0")} ${p.en} / ${p.ja}` : `#${id}`;
  }

  function enOf(id: number): string | undefined {
    return pokemonList.find((p) => p.id === id)?.en;
  }

  function evoOptionsHtml(selected: number | null): string {
    const opts = [`<option value="" ${selected === null ? "selected" : ""}>（リストにない／未設定）</option>`];
    for (const p of pokemonList) {
      if (p.id === selectedId) continue;
      opts.push(`<option value="${p.id}" ${selected === p.id ? "selected" : ""}>${escapeHtml(nameOf(p.id))}</option>`);
    }
    return opts.join("");
  }

  function renderEvoRow(ref: EvolutionRef, path: string): string {
    return `
      <div class="admin-evo-row" data-path="${path}">
        <select data-evo-field="id">${evoOptionsHtml(ref.id)}</select>
        <input data-evo-field="en" type="text" placeholder="English（リスト外の場合）" value="${escapeHtml(ref.en ?? "")}" ${ref.id !== null ? "disabled" : ""} />
        <input data-evo-field="ja" type="text" placeholder="日本語（リスト外の場合）" value="${escapeHtml(ref.ja ?? "")}" ${ref.id !== null ? "disabled" : ""} />
        <input data-evo-field="condition" type="text" placeholder="進化条件（例: Lv.16で進化）" value="${escapeHtml(ref.condition)}" />
        ${path.startsWith("to.") ? `<button type="button" class="admin-btn" data-action="remove-evo-to" data-index="${path.slice(3)}">削除</button>` : ""}
      </div>
    `;
  }

  function renderForm(): string {
    if (!current) return "";
    const typesHtml = current.types
      .map(
        (t, i) => `
          <div class="admin-inline-row" data-index="${i}">
            <input data-type-field="en" type="text" placeholder="English" value="${escapeHtml(t.en)}" />
            <input data-type-field="ja" type="text" placeholder="日本語" value="${escapeHtml(t.ja)}" />
            <button type="button" class="admin-btn" data-action="remove-type" data-index="${i}">削除</button>
          </div>
        `,
      )
      .join("");

    const statsHtml = STAT_KEYS.map(
      (key) => `
        <label class="admin-field">
          ${STAT_LABELS[key]}
          <input data-stat-field="${key}" type="number" min="0" value="${current!.stats[key]}" />
        </label>
      `,
    ).join("");

    const abilitiesHtml = current.abilities
      .map(
        (a, i) => `
          <div class="admin-inline-row" data-index="${i}">
            <input data-ability-field="en" type="text" placeholder="English" value="${escapeHtml(a.en)}" />
            <input data-ability-field="ja" type="text" placeholder="日本語" value="${escapeHtml(a.ja)}" />
            <label class="admin-checkbox">
              <input data-ability-field="isHidden" type="checkbox" ${a.isHidden ? "checked" : ""} /> 隠れ特性
            </label>
            <button type="button" class="admin-btn" data-action="remove-ability" data-index="${i}">削除</button>
          </div>
        `,
      )
      .join("");

    const movesHtml = current.moves
      .map(
        (m, i) => `
          <div class="admin-inline-row" data-index="${i}">
            <input data-move-field="level" type="number" min="0" placeholder="Lv" value="${m.level}" class="admin-col-id" />
            <input data-move-field="en" type="text" placeholder="English" value="${escapeHtml(m.en)}" />
            <input data-move-field="ja" type="text" placeholder="日本語" value="${escapeHtml(m.ja)}" />
            <button type="button" class="admin-btn" data-action="remove-move" data-index="${i}">削除</button>
          </div>
        `,
      )
      .join("");

    const evolvesFromHtml = renderEvoRow(current.evolvesFrom ?? { id: null, condition: "" }, "from");
    const evolvesToHtml = current.evolvesTo.map((ref, i) => renderEvoRow(ref, `to.${i}`)).join("");

    return `
      <div class="admin-section">
        <h3 class="admin-section-title">タイプ</h3>
        ${typesHtml}
        <button type="button" class="admin-btn" data-action="add-type">＋ タイプ追加</button>
      </div>
      <div class="admin-section">
        <h3 class="admin-section-title">種族値</h3>
        <div class="admin-stat-grid">${statsHtml}</div>
      </div>
      <div class="admin-section">
        <h3 class="admin-section-title">特性</h3>
        ${abilitiesHtml}
        <button type="button" class="admin-btn" data-action="add-ability">＋ 特性追加</button>
      </div>
      <div class="admin-section">
        <h3 class="admin-section-title">レベルアップで覚える技</h3>
        ${movesHtml}
        <button type="button" class="admin-btn" data-action="add-move">＋ 技追加</button>
      </div>
      <div class="admin-section">
        <h3 class="admin-section-title">進化前</h3>
        ${evolvesFromHtml}
      </div>
      <div class="admin-section">
        <h3 class="admin-section-title">進化後</h3>
        ${evolvesToHtml}
        <button type="button" class="admin-btn" data-action="add-evo-to">＋ 進化先追加</button>
      </div>
    `;
  }

  function render() {
    const picker = `
      <div class="admin-toolbar">
        <label class="admin-field admin-field-inline">
          編集するポケモン
          <select id="pokemon-picker">
            <option value="">選択してください</option>
            ${pokemonList
              .map((p) => `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(nameOf(p.id))}</option>`)
              .join("")}
          </select>
        </label>
        ${current ? `<button type="button" class="admin-btn admin-btn-primary" data-action="save">保存</button>` : ""}
        <span class="admin-status admin-status-${statusKind}">${escapeHtml(statusText)}</span>
      </div>
    `;
    container.innerHTML = picker + renderForm();

    const select = container.querySelector<HTMLSelectElement>("#pokemon-picker")!;
    select.addEventListener("change", () => {
      const id = Number(select.value);
      selectedId = select.value ? id : null;
      current = selectedId === null ? null : (details.get(selectedId) ?? emptyDetail(selectedId));
      statusText = "";
      statusKind = "";
      render();
    });
  }

  container.addEventListener("input", (e) => {
    if (!current) return;
    const target = e.target as HTMLInputElement;

    const typeField = target.dataset.typeField;
    if (typeField) {
      const i = Number(target.closest<HTMLDivElement>(".admin-inline-row")!.dataset.index);
      current.types[i] = { ...current.types[i], [typeField]: target.value };
      return;
    }
    const statField = target.dataset.statField as keyof PokemonStats | undefined;
    if (statField) {
      current.stats[statField] = Number(target.value);
      return;
    }
    const abilityField = target.dataset.abilityField;
    if (abilityField) {
      const i = Number(target.closest<HTMLDivElement>(".admin-inline-row")!.dataset.index);
      const value = abilityField === "isHidden" ? target.checked : target.value;
      current.abilities[i] = { ...current.abilities[i], [abilityField]: value };
      return;
    }
    const moveField = target.dataset.moveField;
    if (moveField) {
      const i = Number(target.closest<HTMLDivElement>(".admin-inline-row")!.dataset.index);
      const value = moveField === "level" ? Number(target.value) : target.value;
      current.moves[i] = { ...current.moves[i], [moveField]: value };
      return;
    }
    const evoField = target.dataset.evoField;
    if (evoField) {
      const path = target.closest<HTMLDivElement>(".admin-evo-row")!.dataset.path!;
      const ref: EvolutionRef =
        path === "from" ? (current.evolvesFrom ??= { id: null, condition: "" }) : current.evolvesTo[Number(path.slice(3))];
      if (evoField === "id") {
        const id = target.value ? Number((target as unknown as HTMLSelectElement).value) : null;
        ref.id = id;
        if (id !== null) {
          const p = pokemonList.find((p) => p.id === id);
          ref.en = p?.en;
          ref.ja = p?.ja;
        }
        render();
        return;
      }
      if (evoField === "en" || evoField === "ja" || evoField === "condition") {
        ref[evoField] = target.value;
      }
    }
  });

  container.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action || !current) return;

    const indexAttr = target.dataset.index;
    const index = indexAttr !== undefined ? Number(indexAttr) : -1;

    if (action === "add-type") current.types.push({ en: "", ja: "" });
    else if (action === "remove-type") current.types.splice(index, 1);
    else if (action === "add-ability") current.abilities.push({ en: "", ja: "", isHidden: false });
    else if (action === "remove-ability") current.abilities.splice(index, 1);
    else if (action === "add-move") current.moves.push({ level: 1, en: "", ja: "" });
    else if (action === "remove-move") current.moves.splice(index, 1);
    else if (action === "add-evo-to") current.evolvesTo.push({ id: null, condition: "" });
    else if (action === "remove-evo-to") current.evolvesTo.splice(index, 1);
    else if (action === "save") {
      await save();
      return;
    } else {
      return;
    }
    render();
  });

  async function save() {
    if (!current) return;
    current.moves.sort((a, b) => a.level - b.level);
    if (current.evolvesFrom && current.evolvesFrom.id === null && !current.evolvesFrom.condition) {
      current.evolvesFrom = null;
    }

    details.set(current.id, current);

    // Drop this Pokemon from any other Pokemon's evolvesTo first, so re-parenting
    // (changing which species it evolves from) doesn't leave a stale duplicate link.
    for (const other of details.values()) {
      if (other.id === current.id || other.id === current.evolvesFrom?.id) continue;
      other.evolvesTo = other.evolvesTo.filter((ref) => ref.id !== current!.id);
    }

    // Keep the reverse link consistent when this side points at a listed Pokemon.
    if (current.evolvesFrom?.id != null) {
      const parent = details.get(current.evolvesFrom.id);
      if (parent) {
        const thisEn = enOf(current.id)?.toLowerCase();
        parent.evolvesTo = parent.evolvesTo.filter(
          (ref) => ref.id !== current!.id && !(ref.id === null && thisEn && ref.en?.toLowerCase() === thisEn),
        );
        parent.evolvesTo.push({ id: current.id, condition: current.evolvesFrom.condition });
      }
    }
    for (const child of current.evolvesTo) {
      if (child.id == null) continue;
      const childDetail = details.get(child.id);
      if (childDetail) childDetail.evolvesFrom = { id: current.id, condition: child.condition };
    }

    statusText = "保存中...";
    statusKind = "";
    render();
    const all = [...details.values()].sort((a, b) => a.id - b.id);
    const result = await putData("pokemon-detail", all);
    statusText = result.ok ? "保存しました。" : `保存に失敗しました: ${result.error}`;
    statusKind = result.ok ? "ok" : "error";
    render();
  }

  (async () => {
    statusText = "読み込み中...";
    render();
    try {
      pokemonList = await getData<TermEntry[]>("pokemon");
      const detailList = await getData<PokemonDetail[]>("pokemon-detail");
      details = new Map(detailList.map((d) => [d.id, d]));
      statusText = `${pokemonList.length} 匹`;
      statusKind = "";
    } catch (err) {
      statusText = (err as Error).message;
      statusKind = "error";
    }
    render();
  })();
}
