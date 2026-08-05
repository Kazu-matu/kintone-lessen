---
name: kintone-sptpl-analyzer
description: >
  kintoneのスペーステンプレートファイル(.sptpl)を解析し、アプリ一覧・
  フィールド定義・アプリ間ER図・業務フロー図(Mermaid)を含むHTML/Markdown
  レポートを生成します。「sptpl」「スペーステンプレート」「kintone テンプレート解析」
  などのキーワードで使用してください。
---

# kintone スペーステンプレート解析スキル

kintoneの `.sptpl` ファイル（実体はZIPアーカイブ、`space/template.json` にアプリ定義一式を含む）を解析し、アプリ一覧・フィールド定義・アプリ間関係・業務フローをMermaid図付きのHTML/Markdownレポートとして出力する。

- INPUT: 任意の `*.sptpl` ファイルパス
- OUTPUT: 入力ファイルと同じディレクトリに `<basename>.html` と `<basename>.md`

## 実行手順

### 1. 入力の確認

ユーザーから `.sptpl` ファイルのパスを確認する。指定がなければ聞く。

### 2. 決定的な抽出（スクリプト実行）

以下のコマンドで、ZIP展開・JSON正規化・カスタマイズJS本文の取得までを機械的に行う。

```
node "<スキルディレクトリ>/scripts/extract.js" "<input>.sptpl" "<一時出力先>/analysis.json"
```

出力される `analysis.json` の構造:

```json
{
  "sourceFile": "xxx.sptpl",
  "appCount": 7,
  "apps": [
    {
      "uuid": "...", "name": "顧客管理", "theme": "BLUE", "description": "...",
      "fields": [{ "id":"..", "label":"..", "type":"SINGLE_LINE_TEXT", "var":"..", "required":false, "options":[".."], "unit":".." }],
      "referenceTables": [{ "label":"担当者一覧", "var":"担当者一覧" }],
      "jsFiles": [{ "name":"foo.js", "jsType":"DESKTOP", "content":"...ソース全文..." }],
      "plugins": ["pluginId"], "viewCount": 4, "reportCount": 1
    }
  ],
  "actions": [
    { "name":"担当者を登録する", "actingAppUuid":"..", "actingAppName":"顧客管理", "targetAppUuid":"..", "targetAppName":"担当者管理", "mappingCount":2 }
  ]
}
```

システム項目（作成者/更新者/作成日時/更新日時/ステータス/作業者/カテゴリー）は `fields` から自動的に除外済み。REFERENCE_TABLE型は `referenceTables` に分離されている（紐付け先アプリIDはkintoneのテンプレート出力仕様上保持されないため含まれない）。

### 3. 分析（ここはスクリプト化せず、抽出結果を読んで判断する）

`analysis.json` を読み込み、以下を組み立てる。データはファイルごとに変わるため、機械的なテンプレート当てはめではなく実際の内容を見て判断すること。

- **系統分類**: `actions` の acting→target の連結成分（グラフのつながり）でアプリをグループ化する。どのアプリとも `actions` で繋がらず `referenceTables` の言及も他アプリと関連しないものは「独立系」として扱う。
- **アプリ間関係の推定**: `referenceTables` はどのアプリとの関連か直接わからないため、`actions` の転記関係とラベル文言（「◯◯一覧」「関連◯◯」等）から推定する。推定である旨を必ずレポートに注記する。
- **ステート図の候補検出**: `fields` のうち `type === "SINGLE_SELECT"` で、ラベルに「フェーズ」「ステータス」「進捗」「状態」等を含むものを候補とする。選択肢(options)の並び順や語感（「受注」「失注」「完了」等の終端らしい語）から遷移の妥当性を判断し、実際に業務フローとして意味が通る場合のみ図式化する。無理にこじつけない。
- **JSファイル要約**: `jsFiles[].content` を読み、何をしているカスタマイズか1〜2行で要約する（例:「グループフィールドの開閉状態を制御」）。

### 4. Mermaid図の使い分け指針

| 図の種類 | 用途 | 生成条件 |
|---|---|---|
| `mindmap` | アプリの系統分類 | 常に（2系統以上ある場合） |
| `erDiagram` | レコード番号キーによる紐付け関係 | 常に（連携アプリがある場合） |
| `flowchart` | アプリアクションによる自動転記の向きと項目数 | `actions` が1件以上ある場合 |
| `sequenceDiagram` | 実際の操作順序（登録→転記→記録） | 主要な業務フローが1つ以上特定できる場合 |
| `stateDiagram-v2` | フェーズ/ステータス系フィールドの遷移 | 手順3で候補が見つかった場合のみ |

### 5. HTMLレポート生成

`templates/report.css` の内容を `<style>` タグに埋め込み、以下のセクション構成で1つのHTMLファイルを組み立てる（今回のカスタマイズ入門.sptplの解析で使った構成に準拠）。

1. ヘッダー（ファイル名・アプリ数・アプリアクション数などのサマリ）
2. ファイル形式の説明（ZIP構造）
3. アプリ一覧（カードグリッド）＋ mindmap
4. アプリ間関係（erDiagram + 転記flowchart）
5. アプリアクション一覧（表）
6. 業務フロー概要（sequenceDiagram、必要なら文章の手順リストも併記）
7. カスタマイズJS・プラグイン（表＋要約）
8. アプリ別フィールド定義（アプリごとに表。該当すれば stateDiagram-v2 を添える）
9. フッター（REFERENCE_TABLEの紐付け先が推定である旨の注記）

**Mermaidのレンダリング**: 生成するHTMLはブラウザで直接開かれる想定のため、`<script type="module">` でCDN版mermaid（`https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs` 等）を読み込み、`mermaid.initialize({ startOnLoad: true })` を実行し、各図は `<pre class="mermaid">...</pre>` として埋め込む。オフライン環境で開かれる可能性がある場合はその旨をユーザーに伝える。

### 6. Markdownレポート生成

HTMLと同じセクション構成・同じ内容をMarkdownで作成する。Mermaid図はそのまま ```` ```mermaid ```` フェンスコードブロックとして埋め込む（GitHub等でそのままレンダリングされる）。表もMarkdownテーブル形式にする。

### 7. 保存

入力ファイルと同じディレクトリに、入力ファイルのbasename（拡張子を除いた部分）を使って保存する。

- `<input_dir>/<basename>.html`
- `<input_dir>/<basename>.md`

例: `Z:\kintone\カスタマイズ入門.sptpl` → `Z:\kintone\カスタマイズ入門.html`, `Z:\kintone\カスタマイズ入門.md`

### 8. 完了報告

生成したファイルパスをユーザーに報告する。claude.ai上のArtifactとして公開するかどうかはユーザーに確認してから行う（無断で公開しない）。

## 注意事項

- REFERENCE_TABLEの紐付け先アプリ設定はテンプレート出力に保持されないため、フィールド名とアプリアクションから関係を推定している旨を必ずレポート脚注に記載する。
- フィールドのオプション値・ラベル等の構造情報のみを扱い、レコードの実データ（個人情報等）は対象にしない。
- `extract.js` は `unzip` コマンドに依存する（Git Bash/WSL/Unix系ツールが必要）。
