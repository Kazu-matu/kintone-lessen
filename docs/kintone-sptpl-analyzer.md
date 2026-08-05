# kintone-sptpl-analyzer スキル

kintoneのスペーステンプレートファイル(`.sptpl`)を解析し、アプリ一覧・フィールド定義・アプリ間ER図・業務フロー図（Mermaid）を含むHTML/Markdownレポートを自動生成するClaude Codeスキル。

## 概要

`.sptpl` ファイルは実体がZIPアーカイブで、`space/template.json` にスペース内全アプリのフィールド定義・レイアウト・ビュー・レポート・アプリアクション（自動転記設定）・カスタマイズJSが含まれている。このスキルは、その構造を機械的に抽出した上で、アプリ間の連携関係やフィールドの意味を読み取り、以下を含むレポートを生成する。

- アプリ一覧（系統分類つき mindmap）
- アプリ間関係（ER図、転記の向きを示す flowchart）
- アプリアクション（自動転記）一覧表
- 業務フロー概要（sequenceDiagram）
- カスタマイズJS・プラグイン一覧とソース要約
- アプリ別フィールド定義表（該当すれば商談フェーズ等の stateDiagram）

処理は決定的な部分と判断が必要な部分に分かれる。

| 種別 | 内容 | 担当 |
|---|---|---|
| 決定的（機械的） | ZIP展開、JSON正規化、フィールド/アプリアクション/JSファイル本文の抽出 | `scripts/extract.js`（Node.js） |
| 判断が必要 | アプリの系統分類、ER関係の推定、ステート図化するフィールドの選定、JS要約、業務フロー文章化 | スキル実行時にClaudeが抽出結果を読んで組み立て |

REFERENCE_TABLE型フィールドの紐付け先アプリ設定はkintoneのテンプレート出力仕様上保持されないため、フィールド名とアプリアクションの転記関係から関係を推定している（レポート脚注にその旨を明記）。

## ファイル構成

```
.claude/skills/kintone-sptpl-analyzer/
  SKILL.md              … スキル定義（実行手順・Mermaid図の使い分け指針）
  scripts/
    extract.js           … .sptplを展開しJSONに正規化するNodeスクリプト（unzipコマンドに依存）
  templates/
    report.css            … HTMLレポート用の共通スタイル（ライト/ダーク対応）
```

## 利用方法

### 呼び出し

Claude Codeのチャットで、解析したい `.sptpl` ファイルのパスを添えて依頼する。

```
Z:\kintone\カスタマイズ入門.sptpl を解析して
```

またはスキル名を直接指定する。

```
/kintone-sptpl-analyzer Z:\kintone\カスタマイズ入門.sptpl
```

> プロジェクトスキルはセッション開始時に読み込まれるため、スキルファイルを追加・変更した直後の同一セッションでは `/kintone-sptpl-analyzer` として認識されないことがある。その場合はチャットで自然文で依頼すれば、Claudeが `SKILL.md` の手順を直接なぞって実行する。次回のセッションからは正しく認識される。

### 入出力

- INPUT: 任意の `*.sptpl` ファイルパス
- OUTPUT: 入力ファイルと同じディレクトリに以下の2ファイルを生成
  - `<basename>.html` — Mermaid（CDN読込）で図を描画するスタンドアロンHTML。ブラウザで直接開ける
  - `<basename>.md` — 同内容のMarkdown（mermaidコードブロック込み、GitHub等でそのままレンダリング可能）

例: `Z:\kintone\カスタマイズ入門.sptpl` → `Z:\kintone\カスタマイズ入門.html`, `Z:\kintone\カスタマイズ入門.md`

### 前提環境

- Node.js（`extract.js` の実行に必要）
- `unzip` コマンド（Git Bash / WSL等。`extract.js` がZIP展開に使用）

## 他プロジェクトへの複写方法

このスキルはプロジェクト限定スキル（`z:\kintone\.claude\skills\` 配下）として作成されており、他のリポジトリでは自動的には使えない。別プロジェクトでも使いたい場合は以下のいずれかの方法でコピーする。

### 方法A: プロジェクトへの複写（そのプロジェクトだけで使う）

```powershell
Copy-Item -Recurse "Z:\kintone\.claude\skills\kintone-sptpl-analyzer" "<コピー先プロジェクト>\.claude\skills\"
```

コピー先プロジェクトのルートに `.claude\skills\` フォルダがなければ作成される。コピー後、コピー先でセッションを開始すればスキルとして認識される。

### 方法B: ユーザー共通スキルへの複写（どのプロジェクトからでも使う）

```powershell
Copy-Item -Recurse "Z:\kintone\.claude\skills\kintone-sptpl-analyzer" "$env:USERPROFILE\.claude\skills\"
```

`~/.claude/skills/` に置くと、Windowsにログインしている全プロジェクトで共通して使えるようになる（`algorithmic-art` や `pdf` などの標準スキルと同じ置き場所）。

### 複写後の確認

1. コピー先で `.claude/skills/kintone-sptpl-analyzer/SKILL.md`・`scripts/extract.js`・`templates/report.css` の3ファイルが揃っていることを確認
2. `node scripts/extract.js "<任意の.sptplファイル>" "<出力先>.json"` を単体実行し、JSONが正常に出力されることを確認（`unzip` コマンドが使えない環境ではここで失敗する）
3. 新しいセッションで `.sptpl` ファイルの解析を依頼し、`<basename>.html` / `<basename>.md` が入力ファイルと同じディレクトリに生成されることを確認

### 注意事項

- スキル本体（`SKILL.md`・`scripts/`・`templates/`）は特定プロジェクトの業務データを含まない汎用実装なので、そのままコピーして問題ない
- 複写後にレポートのデザイン（配色・レイアウト）を変更したい場合は `templates/report.css` を編集する。HTML生成時にこのCSSの内容がそのまま `<style>` タグに埋め込まれる仕様のため、CSS変更だけで見た目を調整できる
