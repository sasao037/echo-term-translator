#!/usr/bin/env node
// Adds (or updates) one Pokemon in public/data/pokemon.json and
// public/data/pokemon-detail.json using PokeAPI (https://pokeapi.co/).
//
// Usage:
//   node scripts/add-pokemon.mjs <pokeapi-slug> [--ja "日本語名"] [--id N] [--dry-run]
//
// <pokeapi-slug> is the identifier PokeAPI uses for the Pokemon, e.g.
// "charizard", "geodude-alola", "lilligant-hisui". You can find it in the
// PokeAPI URL for that Pokemon (https://pokeapi.co/api/v2/pokemon/<slug>).
//
// This only fetches real, official Pokemon data. Echo-exclusive/fangame-only
// Pokemon aren't on PokeAPI — add those by hand (see README's "図鑑データの
// メンテナンス" section for the JSON shape).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const POKEMON_JSON = path.join(ROOT, "public/data/pokemon.json");
const DETAIL_JSON = path.join(ROOT, "public/data/pokemon-detail.json");

const API = "https://pokeapi.co/api/v2";

// Chronological order of PokeAPI version groups, oldest first. Used to pick
// the most recent data when a Pokemon's moves/evolution differ across games.
const VERSION_GROUP_ORDER = [
  "red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald",
  "firered-leafgreen", "diamond-pearl", "platinum", "heartgold-soulsilver",
  "black-white", "colosseum", "xd", "black-2-white-2", "x-y",
  "omega-ruby-alpha-sapphire", "sun-moon", "ultra-sun-ultra-moon",
  "lets-go-pikachu-lets-go-eevee", "sword-shield", "the-isle-of-armor",
  "the-crown-tundra", "brilliant-diamond-shining-pearl", "legends-arceus",
  "scarlet-violet", "the-teal-mask", "the-indigo-disk", "red-green-japan",
  "blue-japan", "legends-za", "mega-dimension", "champions",
];

const TYPE_JA = {
  normal: "ノーマル", fighting: "かくとう", flying: "ひこう", poison: "どく",
  ground: "じめん", rock: "いわ", bug: "むし", ghost: "ゴースト",
  steel: "はがね", fire: "ほのお", water: "みず", grass: "くさ",
  electric: "でんき", psychic: "エスパー", ice: "こおり", dragon: "ドラゴン",
  dark: "あく", fairy: "フェアリー", stellar: "ステラ",
};

const STAT_KEY = {
  hp: "hp", attack: "attack", defense: "defense",
  "special-attack": "specialAttack", "special-defense": "specialDefense",
  speed: "speed",
};

const REGION_PREFIX = {
  alola: { en: "Alolan", ja: "アローラ" },
  galar: { en: "Galarian", ja: "ガラル" },
  hisui: { en: "Hisuian", ja: "ヒスイ" },
  paldea: { en: "Paldean", ja: "パルデア" },
};

const CLASSIC_TRIGGERS = new Set(["level-up", "trade", "use-item", "use-move"]);

function capitalize(s) {
  return s.replace(/(^|-)([a-z])/g, (_, sep, c) => (sep === "-" ? " " : "") + c.toUpperCase());
}

function formPrefixFromSlug(slug) {
  for (const [key, val] of Object.entries(REGION_PREFIX)) {
    if (slug.endsWith(`-${key}`)) return { ...val, baseName: slug.slice(0, -(key.length + 1)) };
  }
  return null;
}

const jsonCache = new Map();
async function getJson(url) {
  if (jsonCache.has(url)) return jsonCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${url}`);
  const promise = res.json();
  jsonCache.set(url, promise);
  return promise;
}

function findName(names, lang) {
  return names.find((n) => n.language.name === lang)?.name;
}

async function resolveDisplayName(slugOrSpeciesName) {
  const form = formPrefixFromSlug(slugOrSpeciesName);
  const baseSpeciesName = form ? form.baseName : slugOrSpeciesName;
  const sp = await getJson(`${API}/pokemon-species/${baseSpeciesName}`);
  const baseEn = findName(sp.names, "en") ?? capitalize(sp.name);
  const baseJa = findName(sp.names, "ja-hrkt") ?? sp.name;
  if (form) return { en: `${form.en} ${baseEn}`, ja: `${form.ja}${baseJa}` };
  return { en: baseEn, ja: baseJa };
}

async function abilityNames(name) {
  const data = await getJson(`${API}/ability/${name}`);
  return { en: findName(data.names, "en") ?? capitalize(name), ja: findName(data.names, "ja-hrkt") ?? name };
}

async function moveNames(name) {
  const data = await getJson(`${API}/move/${name}`);
  return { en: findName(data.names, "en") ?? capitalize(name), ja: findName(data.names, "ja-hrkt") ?? name };
}

async function itemNames(name) {
  const data = await getJson(`${API}/item/${name}`);
  return { en: findName(data.names, "en") ?? capitalize(name), ja: findName(data.names, "ja-hrkt") ?? name };
}

function versionRank(detail) {
  return VERSION_GROUP_ORDER.indexOf(detail.version_group.name);
}

function pickBestDetail(details, targetSlug, sourceSlug) {
  const formMatched = details.filter(
    (d) =>
      (!d.evolved_form || d.evolved_form.name === targetSlug) &&
      (!d.base_form || d.base_form.name === sourceSlug),
  );
  const pool0 = formMatched.length ? formMatched : details;
  const classic = pool0.filter((d) => CLASSIC_TRIGGERS.has(d.trigger.name));
  const pool = classic.length ? classic : pool0;
  return pool.reduce((best, d) => (!best || versionRank(d) > versionRank(best) ? d : best), null);
}

async function conditionText(d) {
  const trigger = d.trigger.name;
  const todLabel = d.time_of_day === "day" ? "ひる" : d.time_of_day === "night" ? "よる" : null;

  if (trigger === "level-up") {
    const level = d.min_level;
    const modifiers = [];
    if (d.min_happiness) modifiers.push("なつき度が高い状態");
    if (d.min_beauty) modifiers.push("うつくしさが高い状態");
    if (d.min_affection) modifiers.push("なつき度（あいちゃく）が高い状態");
    if (d.known_move) modifiers.push(`「${(await moveNames(d.known_move.name)).ja}」を覚えた状態`);
    if (d.known_move_type) modifiers.push(`${TYPE_JA[d.known_move_type.name] ?? d.known_move_type.name}タイプの技を覚えた状態`);
    if (d.held_item) modifiers.push(`「${(await itemNames(d.held_item.name)).ja}」を持った状態`);
    if (d.location) modifiers.push("特定の場所にいる状態");
    if (d.party_species) modifiers.push(`手持ちに「${(await resolveDisplayName(d.party_species.name)).ja}」がいる状態`);
    if (todLabel) modifiers.push(`${todLabel}の時間帯`);

    if (level && modifiers.length === 0) return `Lv.${level}で進化`;
    if (level && modifiers.length > 0) return `${modifiers.join("・")}でLv.${level}になると進化`;
    if (!level && modifiers.length > 0) return `${modifiers.join("・")}でLv.upすると進化`;
    return "レベルアップで進化";
  }
  if (trigger === "trade") {
    if (d.held_item) return `「${(await itemNames(d.held_item.name)).ja}」を持たせて通信交換すると進化`;
    if (d.trade_species) return "特定のポケモンと通信交換すると進化";
    return "通信交換すると進化";
  }
  if (trigger === "use-item") {
    return `どうぐ「${(await itemNames(d.item.name)).ja}」を使うと進化`;
  }
  if (trigger === "use-move") {
    if (d.used_move) {
      const move = (await moveNames(d.used_move.name)).ja;
      return `「${move}」を${d.min_move_count ? `${d.min_move_count}回` : ""}使うと進化`;
    }
    return "特定の技を使うと進化";
  }
  return "特殊な条件で進化";
}

function findChainNode(root, speciesName) {
  if (root.species.name === speciesName) return { node: root, parent: null };
  for (const child of root.evolves_to) {
    if (child.species.name === speciesName) return { node: child, parent: root };
    const found = findChainNode(child, speciesName);
    if (found) return found;
  }
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const slug = args.find((a) => !a.startsWith("--"));
  const jaIdx = args.indexOf("--ja");
  const idIdx = args.indexOf("--id");
  return {
    slug,
    jaOverride: jaIdx !== -1 ? args[jaIdx + 1] : undefined,
    idOverride: idIdx !== -1 ? Number(args[idIdx + 1]) : undefined,
    dryRun: args.includes("--dry-run"),
  };
}

async function main() {
  const { slug, jaOverride, idOverride, dryRun } = parseArgs();
  if (!slug) {
    console.error('Usage: node scripts/add-pokemon.mjs <pokeapi-slug> [--ja "日本語名"] [--id N] [--dry-run]');
    process.exit(1);
  }

  console.log(`Fetching PokeAPI data for "${slug}"...`);
  const pokemonData = await getJson(`${API}/pokemon/${slug}`);
  const speciesData = await getJson(pokemonData.species.url);

  const displayName = await resolveDisplayName(slug);
  const en = displayName.en;
  const ja = jaOverride ?? displayName.ja;
  if (!ja) {
    console.error("日本語名が取得できませんでした。--ja \"日本語名\" で指定してください。");
    process.exit(1);
  }

  const pokemonList = JSON.parse(fs.readFileSync(POKEMON_JSON, "utf8"));
  const detailList = JSON.parse(fs.readFileSync(DETAIL_JSON, "utf8"));

  const dupe = pokemonList.find((p) => p.en.toLowerCase() === en.toLowerCase());
  if (dupe && dupe.id !== idOverride) {
    console.error(`既に id=${dupe.id} として登録されています: ${dupe.en} / ${dupe.ja}`);
    console.error("更新したい場合は --id で同じIDを指定してください。");
    process.exit(1);
  }

  const id = idOverride ?? Math.max(0, ...pokemonList.map((p) => p.id)) + 1;
  console.log(`-> id=${id}  ${en} / ${ja}`);

  const types = pokemonData.types
    .sort((a, b) => a.slot - b.slot)
    .map((t) => ({ en: capitalize(t.type.name), ja: TYPE_JA[t.type.name] ?? t.type.name }));

  const stats = {};
  for (const s of pokemonData.stats) stats[STAT_KEY[s.stat.name]] = s.base_stat;

  const abilities = [];
  for (const a of [...pokemonData.abilities].sort((x, y) => x.slot - y.slot)) {
    const names = await abilityNames(a.ability.name);
    abilities.push({ en: names.en, ja: names.ja, isHidden: a.is_hidden });
  }

  console.log(`技を取得中 (${pokemonData.moves.length}件チェック)...`);
  const moves = [];
  for (const m of pokemonData.moves) {
    const levelUpDetails = m.version_group_details.filter((v) => v.move_learn_method.name === "level-up");
    if (levelUpDetails.length === 0) continue;
    const best = levelUpDetails.reduce((a, b) =>
      VERSION_GROUP_ORDER.indexOf(b.version_group.name) > VERSION_GROUP_ORDER.indexOf(a.version_group.name) ? b : a,
    );
    const names = await moveNames(m.move.name);
    moves.push({ level: best.level_learned_at, en: names.en, ja: names.ja });
  }
  moves.sort((a, b) => a.level - b.level);

  const idByEnLower = new Map(pokemonList.map((p) => [p.en.toLowerCase(), p.id]));

  let evolvesFrom = null;
  let evolvesTo = [];
  if (speciesData.evolution_chain) {
    const chain = await getJson(speciesData.evolution_chain.url);
    const found = findChainNode(chain.chain, speciesData.name);
    if (found) {
      const { node, parent } = found;
      if (parent) {
        const best = pickBestDetail(node.evolution_details, slug, parent.species.name);
        const name = await resolveDisplayName(parent.species.name);
        const existingId = idByEnLower.get(name.en.toLowerCase()) ?? null;
        evolvesFrom = {
          id: existingId,
          ...(existingId === null ? { en: name.en, ja: name.ja } : {}),
          condition: best ? await conditionText(best) : "進化",
        };
      }
      for (const child of node.evolves_to) {
        const best = pickBestDetail(child.evolution_details, child.species.name, slug);
        const name = await resolveDisplayName(child.species.name);
        const existingId = idByEnLower.get(name.en.toLowerCase()) ?? null;
        evolvesTo.push({
          id: existingId,
          ...(existingId === null ? { en: name.en, ja: name.ja } : {}),
          condition: best ? await conditionText(best) : "進化",
        });
      }
    }
  }

  const newEntry = { id, en, ja };
  const newDetail = { id, types, stats, abilities, moves, evolvesFrom, evolvesTo };

  if (dryRun) {
    console.log("\n--dry-run: 書き込みは行いません。生成結果:\n");
    console.log(JSON.stringify(newEntry, null, 2));
    console.log(JSON.stringify(newDetail, null, 2));
    return;
  }

  const pokemonIdx = pokemonList.findIndex((p) => p.id === id);
  if (pokemonIdx === -1) pokemonList.push(newEntry);
  else pokemonList[pokemonIdx] = newEntry;

  const detailIdx = detailList.findIndex((p) => p.id === id);
  if (detailIdx === -1) detailList.push(newDetail);
  else detailList[detailIdx] = newDetail;

  // Fix up reverse links so existing entries point at the newly added one.
  if (evolvesFrom?.id != null) {
    const parentDetail = detailList.find((p) => p.id === evolvesFrom.id);
    if (parentDetail) {
      // Replace a stale unlinked placeholder for this species (if any) or an
      // entry from a previous run, then add the real link.
      parentDetail.evolvesTo = parentDetail.evolvesTo.filter(
        (e) => e.id !== id && !(e.id === null && e.en?.toLowerCase() === en.toLowerCase()),
      );
      parentDetail.evolvesTo.push({ id, condition: evolvesFrom.condition });
    }
  }
  for (const child of evolvesTo) {
    if (child.id == null) continue;
    const childDetail = detailList.find((p) => p.id === child.id);
    if (childDetail) childDetail.evolvesFrom = { id, condition: child.condition };
  }

  detailList.sort((a, b) => a.id - b.id);
  pokemonList.sort((a, b) => a.id - b.id);

  fs.writeFileSync(POKEMON_JSON, JSON.stringify(pokemonList, null, 2) + "\n");
  fs.writeFileSync(DETAIL_JSON, JSON.stringify(detailList) + "\n");

  console.log(`\n${POKEMON_JSON} と ${DETAIL_JSON} を更新しました。`);
  console.log("差分を確認し、必要なら Echo 独自の変更点（タイプ・技・進化条件など）を手動で修正してください。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
