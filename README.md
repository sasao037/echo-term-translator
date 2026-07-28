# Pokémon Echo 用語辞典

ファンメイド作品「Pokémon Echo」向けの、地名・用語の英日翻訳＆攻略情報ツールです。
Pokémon Echoの制作者、株式会社ポケモン、任天堂、Game Freakとは一切関係のない非公式ツールです。

## 主な機能

### 検索タブ（検索）
- 地名・用語・どうぐを英語⇔日本語でキーワード検索できます。
- マッチングは前方一致を優先し、次に部分一致（大文字小文字を区別しない）。ひらがな入力もカタカナに正規化して照合するため、かな表記の違いを吸収します。
- 検索結果はカテゴリバッジ（色分け）＋英語表記＋矢印＋日本語表記の形式で表示されます。
- 検索履歴を `localStorage` に保存（最大15件）。入力欄が空のときは履歴チップとして表示され、クリアも可能です。
- ポケモンの検索結果はクリックすると詳細パネル（モーダル）が開き、タイプ・種族値・特性・レベルアップで覚える技を確認できます。

### 攻略情報タブ（攻略情報）
- `public/data/guide.json` を読み込み、各セクションを折りたたみ可能な `<details>` として表示します。
- 独自の軽量Markdown風記法に対応：`■見出し`、`- リスト`（ネスト対応）、`|テーブル|`行、`**太字**`/`*斜体*`、通常の段落は `<br>` で連結。
- 現在のセクション例：公式作品との違い、Echo独自の仕様、オブスキュアド・ホロウ、進化（アイテム／わざ／レベル）、進化アイテム入手場所、Mega進化、色違い、Windows版インストール、操作方法、バグ・不具合など。

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

`towns.json` / `terms.json` / `items.json` / `pokemon.json` の各エントリは `{ id, en, ja }` の形式です（型定義は `src/types.ts`）。`pokemon.json` は Echo に登場するポケモンの英語名・日本語名の対応表です。

`pokemon-detail.json` は `pokemon.json` の `id` に対応する詳細データ（タイプ・種族値・特性・レベルアップ技）で、検索結果からポケモンをクリックした際に遅延取得されます。データは本家ポケモン公式データ（[PokeAPI](https://pokeapi.co/)）を基に生成していますが、Echo独自の変更点（タイプ・ステータス・技構成の改変など）が反映されていない場合があります。差分に気づいた場合は個別に修正します。

## 技術スタック

- TypeScript + Vite（フレームワーク非依存のバニラDOM実装、`src/main.ts` がエントリポイント）
- 依存ライブラリなし（`dependencies` は空）
- Cloudflare Workers / Pages への静的アセット配信を想定（`wrangler.jsonc`）

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
