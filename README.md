# Pokémon Echo 用語辞典

ファンメイド作品「Pokémon Echo」向けの、地名・用語・ポケモンの英日翻訳＆攻略情報ツールです。
Pokémon Echoの制作者、株式会社ポケモン、任天堂、Game Freakとは一切関係のない非公式ツールです。

## 主な機能

### 検索タブ
- 地名・用語・どうぐ・ポケモンを英語⇔日本語でキーワード検索できます。
- マッチングは前方一致を優先し、次に部分一致（大文字小文字を区別しない）。ひらがな入力もカタカナに正規化して照合するため、かな表記の違いを吸収します。
- 検索結果はカテゴリバッジ（色分け）＋英語表記＋矢印＋日本語表記の形式で表示されます。
- 検索履歴を `localStorage` に保存（最大15件）。入力欄が空のときは履歴チップとして表示され、クリアも可能です。
- ポケモンの検索結果をクリックすると詳細パネル（モーダル）が開き、以下を確認できます。
  - タイプ（色分けバッジ）
  - 種族値（バーグラフ表示）
  - 特性（日英併記、隠れ特性は明示）
  - レベルアップで覚える技（レベル・技名の日英）
  - 進化情報（進化前／進化後のポケモンと進化条件）。進化前後のポケモンはクリックでそのまま詳細パネルを遷移できます。

### 攻略情報タブ
- `public/data/guide.json` を読み込み、各セクションを折りたたみ可能な `<details>` として表示します。
- 独自の軽量Markdown風記法に対応：`■見出し`、`- リスト`（ネスト対応）、`|テーブル|`行、`**太字**`/`*斜体*`、通常の段落は `<br>` で連結。
- 現在のセクション例：公式作品との違い、Echo独自の仕様、オブスキュアド・ホロウ、進化（アイテム／わざ／レベル）、進化アイテム入手場所、Mega進化、色違い、Windows版インストール、操作方法、バグ・不具合など。
- 「ポケモン図鑑」セクション（アコーディオン、初回展開時に遅延読み込み）に、Echo に登場する220匹をNo.順のグリッドカードで一覧表示。No./英名/和名/タイプバッジを表示し、カードをクリックすると検索結果と同じ詳細パネルが開きます。

## データ構成

すべて `public/data/` 配下のJSONファイルで、実行時に `BASE_URL` 相対パスで取得します。

| ファイル | カテゴリ | ラベル | 件数（目安） |
| --- | --- | --- | --- |
| `towns.json` | `town` | 地名 | 30件 |
| `terms.json` | `term` | 用語 | 28件 |
| `items.json` | `item` | どうぐ | 0件（未登録） |
| `pokemon.json` | `pokemon` | ポケモン | 220件 |
| `pokemon-detail.json` | - | - | 220件 |
| `guide.json` | - | - | 12セクション |

- `towns.json` / `terms.json` / `items.json` / `pokemon.json` は `{ id, en, ja }` 形式の一覧です（型定義は `src/types.ts`）。`pokemon.json` は Echo に登場するポケモンの英語名・日本語名の対応表です。
- `pokemon-detail.json` は `pokemon.json` の `id` に対応する詳細データ（タイプ・種族値・特性・レベルアップ技・進化情報）で、検索結果やポケモン図鑑からポケモンを開いた際に遅延取得されます。
- `guide.json` は `{ id, titleEn, titleJa, body }` の配列で、`body` は独自の軽量Markdown風記法のテキストです。

**データの出所について:** `pokemon.json` / `pokemon-detail.json` は、[PokeAPI](https://pokeapi.co/) の公式データ（タイプ・種族値・特性・レベルアップ技・進化条件）を基に生成しています。Echo が独自に変更している箇所（タイプ・ステータス・技構成・進化条件の改変など）は反映されていない場合があります。差分に気づいた場合は該当ポケモンだけ個別に修正する運用です。

## データのメンテナンス

### ポケモンリストの更新（追加・修正）

`scripts/add-pokemon.mjs` で、実在のポケモン1匹分を [PokeAPI](https://pokeapi.co/) から取得して `public/data/pokemon.json` と `public/data/pokemon-detail.json` に追加・上書きできます。

```bash
# まず内容を確認（ファイルには書き込まれない）
node scripts/add-pokemon.mjs charizard --dry-run

# 追加（idは既存の最大値+1が自動採番される）
node scripts/add-pokemon.mjs charizard

# 日本語名が正しく取れない/上書きしたい場合
node scripts/add-pokemon.mjs charizard --ja "リザードン"

# 既存エントリの更新（同じ id を明示すると上書きされる）
node scripts/add-pokemon.mjs charizard --id 4
```

- `<pokeapi-slug>` は PokeAPI 上の識別子です。`https://pokeapi.co/api/v2/pokemon/<slug>` でそのポケモンのデータが見られる名前を指定してください（例: `charizard`、アローラ・ヒスイなどのフォームは `geodude-alola` / `lilligant-hisui` のように地方名サフィックス付き）。
- タイプ・種族値・特性・レベルアップ技・進化情報（進化前後の条件テキスト）をまとめて生成します。進化前後の相手が既にリスト内にいれば自動でリンク（相手側の進化情報も双方向に更新）、いなければ名前だけ表示され、後で追加すれば自動でリンクされます。
- 生成されるのは本家ポケモンのデータです。**Echo 側で変更されている場合は生成後に該当ファイルを手動で直してください**（差分修正の運用は変わりません）。
- Echo オリジナル（本家に存在しない）ポケモンは PokeAPI から取得できないため、`public/data/pokemon.json` と `public/data/pokemon-detail.json` に直接エントリを追記してください。型定義（`src/types.ts` の `TermEntry` / `PokemonDetail`）に沿った最小構成の例:

  ```json
  // pokemon.json に追記
  { "id": 221, "en": "Example", "ja": "サンプル" }
  ```
  ```json
  // pokemon-detail.json に追記
  {
    "id": 221,
    "types": [{ "en": "Normal", "ja": "ノーマル" }],
    "stats": { "hp": 50, "attack": 50, "defense": 50, "specialAttack": 50, "specialDefense": 50, "speed": 50 },
    "abilities": [{ "en": "Example Ability", "ja": "サンプルとくせい", "isHidden": false }],
    "moves": [{ "level": 1, "en": "Tackle", "ja": "たいあたり" }],
    "evolvesFrom": null,
    "evolvesTo": []
  }
  ```

### 攻略情報の編集・追記

`public/data/guide.json` は `{ id, titleEn, titleJa, body }` の配列です。セクションを追加するには、この形式のオブジェクトを配列に追記するだけです（`id` は他と重複しない文字列であれば何でも構いません）。

`body` は素朴なMarkdown風記法のプレーンテキストで、`src/guide.ts` の `renderGuideBody` がレンダリングします。空行区切りのブロックごとに以下のルールが適用されます。

| 記法 | 結果 |
| --- | --- |
| ブロック先頭が `■見出し` | `<h4>` 見出し（見出し行の続きは通常どおりレンダリング） |
| ブロック先頭が `\|` | Markdown風テーブル。1行目が見出し行（例: `\|英語\|日本語\|`） |
| ブロック内の全行が `- ` で始まる | 箇条書き。半角スペース4つ以上のインデントで一段ネスト |
| それ以外 | 段落。行と行の間は `<br>` で連結 |
| `**太字**` / `*斜体*` | インライン装飾（上記どのブロック内でも使用可） |

編集後は `npm run dev` でプレビューして表示崩れがないか確認してください。

## 技術スタック

- TypeScript + Vite（フレームワーク非依存のバニラDOM実装）
- 依存ライブラリなし（`dependencies` は空、`devDependencies` は `typescript` / `vite` / `wrangler` のみ）
- Cloudflare Workers / Pages への静的アセット配信を想定（`wrangler.jsonc`）

### ソース構成（`src/`）

| ファイル | 役割 |
| --- | --- |
| `main.ts` | エントリポイント。タブ切り替え、検索UI、ポケモン詳細モーダル、ポケモン図鑑の描画・イベント処理 |
| `search.ts` | 全カテゴリのデータ読み込みと検索（前方一致・部分一致、かな正規化） |
| `pokemon-detail.ts` | `pokemon-detail.json` の遅延読み込み・キャッシュ |
| `guide.ts` | `guide.json` の読み込みと独自Markdown風記法のレンダリング |
| `history.ts` | 検索履歴の `localStorage` 読み書き |
| `type-colors.ts` | ポケモンのタイプ別バッジ色 |
| `types.ts` | 共通の型定義とカテゴリラベル |
| `html.ts` | HTMLエスケープ用ユーティリティ |

## 開発

```bash
npm install
npm run dev       # 開発サーバー起動
npm run build     # 型チェック（tsc -b）＋ Vite ビルド
npm run preview   # ビルド成果物のプレビュー
```

## デプロイ

`wrangler.jsonc` にて `dist` ディレクトリを静的アセットとして配信する設定になっています。

```bash
npm run build
npx wrangler deploy
```
