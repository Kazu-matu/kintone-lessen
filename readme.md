# kintone テーブル展開カスタマイズ ＆ E2Eテストプロジェクト

<!--
課題名: プロジェクトREADME
版数: 1.0.0
作成日: 2026-08-05
作成者: Antigravity
ツール: Antigravity
-->

本プロジェクトは、cybozu.com kintoneアプリにおける「受注管理」アプリから「受注明細」アプリへのサブテーブルデータ展開処理のカスタマイズJSプログラム、その設計仕様書、および動作確認用のPlaywrightによる自動E2Eテスト環境をまとめた統合プロジェクトである。

---

## 1. フォルダ構成 ＆ ガイド

本リポジトリの全体構造、および各ディレクトリの役割を示す。

```text
z:\kintone\
├── docs/                      # 各種設計仕様書・ガイド類
│   ├── CN-057-9-1.md          # 課題1: 新規一括登録（POSTのみ）設計書 ＆ フロー図
│   ├── CN-058-9-2.md          # 課題2: 一括登録と採番ID書き戻し（POST & PUT）設計書
│   ├── CN-059-9-3.md          # 課題3: 新規・既存の自動判別と更新（POST/PUT並行）設計書
│   ├── CN-057-9-4.md          # 課題4: 顧客コード・郵便番号制御等 設計書
│   ├── e2e_test_plan.md       # E2Eテストの全体計画書、テスト結果、トラブルシューティング
│   ├── e2e_test_spec.md       # E2Eテスト（table_expand.spec.js）の詳細動作仕様書
│   ├── budget_achievement_spec.md  # 予実管理アプリ連携の動作仕様書
│   ├── 受注管理仕様.md        # 受注管理・明細アプリの全体構成・フィールド設定ドキュメント
│   └── mcp_guide.md           # MCPサーバー連携ガイド
│
├── src/                       # kintone JavaScript カスタマイズコード
│   └── 課題/                  # 課題ごとのJavaScriptコード本体
│         ├── table_expand_1.js # 課題1のソースコード (JSDoc付)
│         ├── table_expand_2.js # 課題2のソースコード (JSDoc付)
│         ├── table_expand_3.js # 課題3のソースコード (JSDoc付)
│         ├── cn-057-9-4.js     # 課題4のソースコード (JSDoc付)
│         └── budget_achievement.js  # 予実管理連携のソースコード (JSDoc付)
│
├── e2e/                       # Playwright E2Eテスト関連
│   ├── table_expand.spec.js   # テストスクリプト本体
│   └── evidence/              # テスト実行時に自動撮影されるエビデンス画像（PNG）の保存先
│         ├── CN-057-9-1/      # 課題1の実行エビデンス画像群 (before, after, detail_records)
│         ├── CN-058-9-2/      # 課題2の実行エビデンス画像群
│         └── CN-059-9-3/      # 課題3の実行エビデンス画像群
│
├── .env.example               # 環境変数テンプレートファイル
├── playwright.config.js       # Playwright の実行構成ファイル (1ワーカー/タイムアウト設定)
├── package.json               # Node.js 依存関係定義 (Playwright, dotenv)
└── readme.md                  # 本ドキュメント (プロジェクトルートガイド)
```

---

## 2. 課題・ファイル対比ガイド

各課題ごとのソースコード、仕様書、およびテスト実行時の検証項目のマッピングは以下の通りである。

| 課題ID | 課題名・機能 | 適用JSソース | 設計仕様書 (Mermaid図含む) | E2Eテスト検証範囲 |
| :--- | :--- | :--- | :--- | :--- |
| **CN-057-9-1** | 課題1: 新規一括登録 (POSTのみ) | [src/課題/table_expand_1.js](src/課題/table_expand_1.js) | [docs/CN-057-9-1.md](docs/CN-057-9-1.md) | 親のサブテーブルを展開し、子アプリへ全行POST登録されることを確認。親のサブテーブルへのID書き戻しは行わない。 |
| **CN-058-9-2** | 課題2: 一括登録と採番ID書き戻し (POST & PUT) | [src/課題/table_expand_2.js](src/課題/table_expand_2.js) | [docs/CN-058-9-2.md](docs/CN-058-9-2.md) | 子アプリへのPOST登録後、採番されたレコードIDを親のサブテーブル（受注明細番号）へPUTで書き戻すことを確認。 |
| **CN-059-9-3** | 課題3: 新規・既存の自動判別と更新 (POST/PUT並行) | [src/課題/table_expand_3.js](src/課題/table_expand_3.js) | [docs/CN-059-9-3.md](docs/CN-059-9-3.md) | サブテーブル行のうち、明細番号がある行は子レコードを更新（PUT）、空の行は新規登録（POST）してIDを書き戻す並行処理を確認。 |
| **CN-057-9-4** | 課題4: 顧客コード自動生成・郵便番号制御等 | [src/課題/cn-057-9-4.js](src/課題/cn-057-9-4.js) | [docs/CN-057-9-4.md](docs/CN-057-9-4.md) | 顧客マスター等における顧客コード自動発番、住所取得制御のロジック。 |

---

## 3. E2E自動テストの実行手順

本プロジェクトには、画面操作と kintone REST API を利用したテストデータの自動セットアップ・クリーンアップロジックが統合されたE2E自動テスト環境が備わっています。

### 3.1. 事前準備

1. **パッケージのインストール**:
   ```bash
   npm install
   ```
2. **環境変数 `.env` の配置**:
   リポジトリルートに `.env` ファイルを作成し、接続情報を記述します（`.env.example` 参照）。
   ```env
   KINTONE_BASE_URL=https://your-subdomain.cybozu.com
   KINTONE_USER=your_username
   KINTONE_PASSWORD=your_password
   APP_ID_PARENT=22
   APP_ID_CHILD=24
   ```

### 3.2. テストの実行

以下のコマンドで自動テストを実行します。
```bash
npx playwright test
```

### 3.3. エビデンス画像の確認
テストが完了すると、自動的にブラウザ画面が撮影され、以下のディレクトリに検証フェーズごとのPNG画像が保存されます。
- **保存先**: `e2e/evidence/{課題ID}/`
  - `01_before_click.png` (ボタンを押す前の詳細画面)
  - `03_after_click.png` (ボタンを押して自動リロードされた後の親レコード画面)
  - `04_detail_records.png` (受注明細アプリに登録された子レコードの一覧画面)

テストの各検証フェーズおよび過去のトラブルシューティング（API接続時の400エラーやダイアログ撮影のタイムアウト回避など）の詳細は、[docs/e2e_test_plan.md](docs/e2e_test_plan.md) および [docs/e2e_test_spec.md](docs/e2e_test_spec.md) を参照してください。
