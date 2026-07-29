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
- 各セクションを折りたたみ可能な `<details>` として表示します。
- 独自の軽量Markdown風記法に対応：`■見出し`、`- リスト`（ネスト対応）、`|テーブル|`行、`**太字**`/`*斜体*`、通常の段落は `<br>` で連結。
- 現在のセクション例：公式作品との違い、Echo独自の仕様、オブスキュアド・ホロウ、進化（アイテム／わざ／レベル）、進化アイテム入手場所、Mega進化、色違い、Windows版インストール、操作方法、バグ・不具合など。
- 「ポケモン図鑑」セクション（アコーディオン、初回展開時に遅延読み込み）に、Echo に登場する220匹をNo.順のグリッドカードで一覧表示。No./英名/和名/タイプバッジを表示し、カードをクリックすると検索結果と同じ詳細パネルが開きます。

### 管理画面（`/admin`）
パスワード保護された編集画面から、サイトのデータ（攻略情報・地名・用語・どうぐ・ポケモン名・ポケモン詳細）を編集し、**保存すると即座に本番サイトへ反映**されます。詳細は下記「管理画面」を参照してください。

## アーキテクチャ

このサイトは Cloudflare Workers 上で、静的アセット配信 + Worker（`worker/index.ts`）+ Cloudflare KV の組み合わせで動いています。

- 表示用の静的ファイル（HTML/CSS/JS）は `dist/`（ビルド成果物）から配信されます。
- サイトのコンテンツ（地名・用語・どうぐ・ポケモン名・ポケモン詳細・攻略情報）は Cloudflare KV に保存され、`GET /api/data/:name` で取得されます。KVにまだ値がない場合は `public/data/*.json`（ビルドに同梱される初期データ）から自動的に読み込まれ、そのままKVに書き込まれます（＝gitのJSONファイルは「初期値」、KVが「本番の正」）。
- 管理画面からの保存は `PUT /api/data/:name`（要ログイン）がKVに書き込みます。書き込み後は次のアクセスから即座に公開サイトへ反映されます（再デプロイ不要）。
- ログインは管理者パスワード1つ（Cloudflare Secret）による認証で、成功するとHMAC署名付きのセッションCookie（有効期限7日、`HttpOnly`/`Secure`/`SameSite=Strict`）が発行されます。

`:name` に指定できる値: `guide` / `towns` / `terms` / `items` / `pokemon` / `pokemon-detail`

## データの形式

| 名前 (`:name`) | 形式 | 件数（目安） |
| --- | --- | --- |
| `towns` | `{ id, en, ja }` の配列 | 30件 |
| `terms` | 同上 | 28件 |
| `items` | 同上 | 0件（未登録） |
| `pokemon` | 同上（Echoに登場するポケモンの英日名対応表） | 220件 |
| `pokemon-detail` | `pokemon` の `id` に対応する詳細（タイプ・種族値・特性・レベルアップ技・進化情報） | 220件 |
| `guide` | `{ id, titleEn, titleJa, body }` の配列（`body` は独自Markdown風記法） | 12セクション |

型定義は `src/types.ts` を参照してください。

**データの出所について:** `pokemon` / `pokemon-detail` の初期データは、[PokeAPI](https://pokeapi.co/) の公式データ（タイプ・種族値・特性・レベルアップ技・進化条件）を基に生成しています。Echo が独自に変更している箇所（タイプ・ステータス・技構成・進化条件の改変など）は反映されていない場合があります。差分に気づいた場合は管理画面または後述のスクリプトで該当ポケモンだけ個別に修正してください。

## 管理画面

### 使い方
1. `/admin`（`https://<デプロイ先>/admin`）にアクセスし、管理者パスワードでログインします。
2. タブ（攻略情報／地名／用語／どうぐ／ポケモン名／ポケモン詳細）を切り替えて編集します。
   - 攻略情報: セクションの追加・削除・並び替え、本文はその場でプレビュー表示。
   - 地名・用語・どうぐ・ポケモン名: `id` / `en` / `ja` の一覧を行単位で追加・編集・削除。
   - ポケモン詳細: 編集するポケモンを選択し、タイプ・種族値・特性・技・進化情報（進化前後の選択、または「リストにない」場合は英日名を自由入力）を編集。進化前後どちらかにリスト内のポケモンを指定すると、保存時に相手側の進化情報も自動的に整合するよう更新されます。
3. 各タブの「保存」を押すとその場でKVに書き込まれ、公開サイトにも即座に反映されます。

### 初期セットアップ（初回のみ）

管理画面を動かすには、Cloudflareアカウントで以下の準備が必要です（このリポジトリのコード変更だけでは動きません）。

```bash
# 1. Cloudflareにログイン
npx wrangler login

# 2. KV namespaceを作成し、出力された id を wrangler.jsonc の
#    kv_namespaces[0].id に貼り付ける
npx wrangler kv namespace create DATA_KV

# 3. 管理者パスワードとセッション署名用シークレットを設定
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET   # 適当な長いランダム文字列でよい

# 4. デプロイ
npm run build
npx wrangler deploy
```

### ローカルでの動作確認

`.dev.vars.example` を `.dev.vars` にコピーし、任意の値を設定してください（`.dev.vars` はgit管理外です）。

```bash
cp .dev.vars.example .dev.vars
npm run build && npm run worker:dev   # wrangler dev。KVはローカルにエミュレートされる
```

`http://localhost:8787/` が公開サイト、`http://localhost:8787/admin` が管理画面です。`npm run dev`（Vite単体）では `/api/*` が存在しないため、データ取得・管理画面は動作しません。データ取得を伴う動作確認は必ず `npm run worker:dev` を使ってください。

**注意:** 管理画面はパスワード認証のみのシンプルな仕組みです。パスワードは十分に長く推測されにくいものにし、`.dev.vars` や実際のパスワードをコミットしないよう注意してください（`.gitignore` 済み）。

## ポケモンリストの更新（追加・修正）

`scripts/add-pokemon.mjs` で、実在のポケモン1匹分を [PokeAPI](https://pokeapi.co/) から取得して `public/data/pokemon.json` と `public/data/pokemon-detail.json`（＝KVの初期値）に追加・上書きできます。管理画面のポケモン詳細タブでも同様の編集は可能ですが、まとめて多数追加する場合や本家データをそのまま取り込みたい場合はこちらが簡単です。

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
- 生成されるのは本家ポケモンのデータです。**Echo 側で変更されている場合は生成後に該当ファイルまたは管理画面で直してください**。
- **このスクリプトが更新するのはgit管理下の初期データのみで、KVには反映されません。** すでにKVへ移行済みの本番/開発環境に反映するには、コミット後に管理画面から該当ポケモンを開いて保存し直すか、KVを一度リセットしてください。
- Echo オリジナル（本家に存在しない）ポケモンは PokeAPI から取得できないため、管理画面のポケモン詳細タブで新規作成するか、`public/data/pokemon.json` と `public/data/pokemon-detail.json` に直接エントリを追記してください。型定義（`src/types.ts` の `TermEntry` / `PokemonDetail`）に沿った最小構成の例:

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

## 攻略情報のMarkdown風記法

`body` は素朴なMarkdown風記法のプレーンテキストで、`src/guide.ts` の `renderGuideBody` がレンダリングします。空行区切りのブロックごとに以下のルールが適用されます。

| 記法 | 結果 |
| --- | --- |
| ブロック先頭が `■見出し` | `<h4>` 見出し（見出し行の続きは通常どおりレンダリング） |
| ブロック先頭が `\|` | Markdown風テーブル。1行目が見出し行（例: `\|英語\|日本語\|`） |
| ブロック内の全行が `- ` で始まる | 箇条書き。半角スペース4つ以上のインデントで一段ネスト |
| それ以外 | 段落。行と行の間は `<br>` で連結 |
| `**太字**` / `*斜体*` | インライン装飾（上記どのブロック内でも使用可） |

管理画面の攻略情報タブでは、このレンダリング結果をその場でプレビューできます。

## 技術スタック

- TypeScript + Vite（フレームワーク非依存のバニラDOM実装）+ Cloudflare Workers（`worker/`）+ Cloudflare KV
- 依存ライブラリなし（`dependencies` は空）。`devDependencies` は `typescript` / `vite` / `wrangler` / `@cloudflare/workers-types` のみ

### ソース構成（`src/`）

| ファイル | 役割 |
| --- | --- |
| `main.ts` | 公開サイトのエントリポイント。タブ切り替え、検索UI、ポケモン詳細モーダル、ポケモン図鑑の描画・イベント処理 |
| `search.ts` | 全カテゴリのデータ読み込み（`/api/data/*`）と検索（前方一致・部分一致、かな正規化） |
| `pokemon-detail.ts` | `pokemon-detail` データの遅延読み込み・キャッシュ |
| `guide.ts` | `guide` データの読み込みと独自Markdown風記法のレンダリング |
| `history.ts` | 検索履歴の `localStorage` 読み書き |
| `type-colors.ts` | ポケモンのタイプ別バッジ色 |
| `types.ts` | 共通の型定義とカテゴリラベル |
| `html.ts` | HTMLエスケープ用ユーティリティ |
| `admin/` | 管理画面（`admin.html`）一式。ログイン、タブ切り替え、各データ種別のエディタ |

### `worker/`（Cloudflare Worker本体）

| ファイル | 役割 |
| --- | --- |
| `index.ts` | ルーティング。`/api/*` はWorkerが処理し、それ以外は静的アセットにフォールバック |
| `data.ts` | データ種別ごとのバリデーションと、KV読み書き（未セット時は静的JSONから初期化） |
| `auth.ts` | パスワード照合とセッションCookie（HMAC署名）の発行・検証 |
| `env.ts` | Bindings（`ASSETS` / `DATA_KV` / `ADMIN_PASSWORD` / `SESSION_SECRET`）の型定義 |

`scripts/add-pokemon.mjs` はポケモンデータ取得用のメンテナンススクリプト（上記「ポケモンリストの更新」参照）。

## 開発

```bash
npm install
npm run dev              # Vite単体の開発サーバー（UIの見た目確認用。/api/* は動かない）
npm run worker:dev        # wrangler dev（推奨）。/api/* を含めた実際の動作を確認できる。事前に npm run build が必要
npm run build             # 型チェック（tsc -b）＋ Vite ビルド（index.html と admin.html の両方）
npm run preview           # ビルド成果物のプレビュー（Vite。/api/* は動かない）
npm run typecheck:worker  # worker/ 配下の型チェック
```

## デプロイ

```bash
npm run build
npx wrangler deploy
```

初回セットアップ（KV namespace作成・secret設定）については上記「管理画面 > 初期セットアップ」を参照してください。
