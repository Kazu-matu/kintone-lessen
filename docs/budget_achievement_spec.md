# budget_achievement.js 詳細仕様書（SOLID原則リファクタリング版）

本書は、予実管理アプリにおけるカスタマイズビュー「予算達成率」を表示するためのJavaScriptプログラム（`budget_achievement.js`）の詳細仕様について定義します。
本プログラムは、**SOLID原則**に基づき、保守性・可読性・拡張性を重視した設計で実装されています。

---

## 1. アーキテクチャ設計 (SOLID原則の適用)
本プログラムは、機能ごとの役割（責務）を分離し、将来的な表示スタイルの変更やビジネスルールの追加に柔軟に対応できるように設計されています。

### 1.1. クラス構成と責務

| クラス名 | 責務 (SRP) | SOLID原則に関連する設計方針 |
| :--- | :--- | :--- |
| **`HtmlUtil`** | HTML文字列のエスケープ処理（セキュリティ） | 共通ユーティリティとしての単一責務。 |
| **`BudgetRecordModel`** | kintoneの生データからドメインモデルへの変換、差異・達成率の計算（ビジネスロジック） | UI表示や外部フレームワークに依存せず、計算規則のみをカプセル化する。 |
| **`BudgetWarningRule`** | 警告を表示するしきい値や、警告用のスタイル定義（判定ルール） | **Open/Closed（開放閉鎖）の原則:** 警告ルール（100%未満等）や色を拡張・変更する際、他のクラスに影響を与えない。 |
| **`MaterializeTableViewRenderer`** | モデルデータを受け取り、Materialize CSSを適用したHTMLテーブルを構築する（描画処理） | **Liskov Substitution（リスコフの置換）の原則:** 抽象化されたレンダラー定義に従い、他のCSSフレームワーク用のレンダラーと安全に置換可能。 |
| **`BudgetAchievementApp`** | kintoneのライフサイクルイベント監視、ModelとViewの仲介（コントローラー） | **Dependency Inversion（依存性逆転）の原則:** 具体的なCSS定義に依存せず、抽象化された `renderer` オブジェクトにのみ依存する。 |

---

### 1.2. クラス図
以下は、各クラスの関係性とメソッド定義を表したクラス図です。

```mermaid
classDiagram
    class HtmlUtil {
        +escape(str: String) String$
    }

    class BudgetRecordModel {
        +budgetNo: String
        +year: String
        +branch: String
        +budget: Number
        +actual: Number
        +diff: Number
        +achievementRate: Number
    }

    class BudgetWarningRule {
        +threshold: Number
        +isWarning(recordModel: BudgetRecordModel) Boolean
        +getWarningClass() String
    }

    class MaterializeTableViewRenderer {
        -warningRule: BudgetWarningRule
        -_getRateCellClass(recordModel: BudgetRecordModel) String
        +render(recordModels: Array~BudgetRecordModel~) String
    }

    class BudgetAchievementApp {
        +viewName: String
        -renderer: MaterializeTableViewRenderer
        +init() void
    }

    BudgetAchievementApp --> MaterializeTableViewRenderer : 依存関係を注入 (DIP)
    MaterializeTableViewRenderer --> BudgetWarningRule : 警告ルールの判定を委譲 (Strategy)
    MaterializeTableViewRenderer ..> HtmlUtil : 文字列をエスケープ
    MaterializeTableViewRenderer ..> BudgetRecordModel : レンダリング処理
    BudgetWarningRule ..> BudgetRecordModel : 達成率から警告判定
```

---

### 1.3. 処理フロー
以下は、プログラムのイベント発生からデータ処理、および画面描画が行われるまでの詳細フロー図です。

```mermaid
flowchart TD
    Start([イベント発火: app.record.index.show]) --> GetContainer{"#customize 要素が存在するか？"}
    GetContainer -- No --> Exit([終了])
    GetContainer -- Yes --> CheckViewName{"event.viewName === '予算達成率' か？"}
    
    CheckViewName -- No --> Exit
    CheckViewName -- Yes --> CheckRecords{"records が存在し、1件以上あるか？"}
    
    CheckRecords -- No --> ShowNoData["コンテナに「表示対象の予実レコードがありません」を表示"]
    ShowNoData --> Exit
    
    CheckRecords -- Yes --> ConvertModels["kintone生レコードを BudgetRecordModel に変換<br>（差異・達成率の自動計算）"]
    ConvertModels --> CallRenderer["MaterializeTableViewRenderer.render() を呼び出し"]
    
    CallRenderer --> InitTable["HTMLテーブルのヘッダーを作成"]
    InitTable --> LoopStart["レコードごとのループ処理"]
    
    LoopStart --> Escape["HtmlUtil.escape() で文字列をエスケープ"]
    Escape --> WarningCheck{"BudgetWarningRule.isWarning() で警告判定"}
    
    WarningCheck -- Yes --> ApplyWarningClass["警告セル用 CSS クラスを設定"]
    WarningCheck -- No --> SetDefaultClass["クラス指定なし"]
    
    ApplyWarningClass --> BuildRow["行 (tr) の HTML を構築・結合"]
    SetDefaultClass --> BuildRow
    
    BuildRow --> LoopNext{"次のレコードがあるか？"}
    LoopNext -- Yes --> LoopStart
    LoopNext -- No --> FinishTable["テーブルの閉じタグを追加"]
    
    FinishTable --> RenderHTML["生成した HTML をコンテナの innerHTML に設定"]
    RenderHTML --> Exit
```

---

## 2. 動作条件・イベント制御

### 2.1. 起動イベント
- **イベント名:** `app.record.index.show`（レコード一覧画面が表示されたタイミング）
- **備考:** ページネーション（改ページ）の切り替えや、ソート順の変更時にもこのイベントが再発火し、再レンダリングされます。

### 2.2. ガードロジック（実行判定）
プログラムの誤動作を防ぐため、以下の条件に合致しない場合は処理を中断（早期リターン）します。

| 判定対象 | 条件 | 満たさない場合の挙動 |
| :--- | :--- | :--- |
| **描画コンテナ** | `div#customize` が画面に存在すること | 処理を中断（標準ビューへの影響防止） |
| **現在の一覧名** | `event.viewName` が `'予算達成率'` であること | 処理を中断（他の一覧への影響防止） |

### 2.3. データなし（0件）時の制御
取得したレコード数（`event.records.length`）が `0` 件、またはレコード自体が存在しない場合、テーブルの代わりに以下のメッセージをコンテナ内に表示します。
- **表示内容:** `表示対象の予実レコードがありません。`（Materializeのフォントサイズクラス `flow-text` を適用）

---

## 3. データ処理・計算仕様 (Model: `BudgetRecordModel`)

### 3.1. 取得フィールド
各レコードから以下のフィールド値を取得します。値が存在しない場合のデフォルト値も規定します。

| フィールド名 | フィールドコード | 内部データ型 | 値がない場合のデフォルト値 |
| :--- | :--- | :--- | :--- |
| **予算No** | `予算No` | 文字列 | `''`（空文字） |
| **年度** | `年度` | 文字列 | `''`（空文字） |
| **拠点** | `拠点` | 文字列 | `''`（空文字） |
| **予算** | `予算` | 数値型（`Number`） | `0` |
| **実績** | `実績` | 数値型（`Number`） | `0` |

### 3.2. 差異の算出
実績から予算を引いた数値を算出します。
- **計算式:** `差異 = 実績 - 予算`
- **表示フォーマット:**
  - 金額を3桁カンマ区切りにする（`toLocaleString()` を適用）。
  - 算出結果が `0` 以上の正数の場合、数値の先頭に `+` を付与する。
  - 末尾に ` 円` を付与する。（例: `+150,000 円`, `-50,000 円`）

### 3.3. 達成率の算出とゼロ除算防止
予算に対する実績の割合（%）を算出します。
- **計算式:** `達成率 (%) = (実績 / 予算) * 100`
- **ゼロ除算 (Division by Zero) 防止ガード:**
  - 予算が `0` または空欄（デフォルト値 `0`）の場合は計算を行わず、達成率を **`0.00 %`** とします。
- **丸め処理（小数点第3位以下切り捨て）:**
  - 小数点第3位以下を数学的に切り捨てるため、`Math.floor(rawRate * 100) / 100` を用いて計算します。
  - 画面上には、`toFixed(2)` を用いて小数点以下第2位まで常に表示します。（例: `98.76 %`）

---

## 4. 表示・スタイリング仕様 (View/Renderer: `MaterializeTableViewRenderer`)

### 4.1. Materialize CSS とは
Materialize CSS は、Googleが提唱する**「マテリアルデザイン（Material Design）」**のガイドラインに沿って作られたモダンなフロントエンドCSSフレームワークです。
洗練された立体感やアニメーション、統一感のあるカラーパレットが特徴で、定義された特定のCSSクラス名（`striped` や `red lighten-5` など）をHTML要素に付与するだけで、美しく直感的なインターフェースを簡単に構築することができます。
本プログラムでは、CDN経由でライブラリをインポートしてテーブル表示のデザイン最適化に利用しています。

### 4.2. テーブル全体のスタイル
生成する `<table>` 要素には以下のMaterializeクラスを適用します。
- `striped`: 行ごとに背景色が交互に変わるストライプ表示。
- `responsive-table`: 画面幅に合わせて横スクロール可能なレスポンシブ対応。
- `highlight`: マウスホバー時に対象行をハイライト。

### 4.3. 表ヘッダー定義
テーブルヘッダー（`<thead>`）には以下の列名を定義します（左からの配置順）。
1. **予算No**
2. **年度**
3. **拠点**
4. **予算**
5. **実績**
6. **差異**
7. **達成率**

### 4.4. 達成率100%未満のハイライト (Strategy: `BudgetWarningRule`)
達成率が **100%未満** のレコードに対しては、達成率を表示するセル（`<td>`）のみスタイルを以下のように変更します。

| 項目 | 適用する Materialize クラス | 効果 |
| :--- | :--- | :--- |
| **背景色** | `red lighten-5` | ごく淡い赤色の背景 |
| **文字色** | `red-text text-accent-4` | 濃い鮮やかな赤文字 |
| **フォント** | inline: `font-weight: bold;` | 太字表記 |

---

## 5. セキュリティ設計 (Utility: `HtmlUtil`)

ユーザーが任意に入力可能な文字列型フィールド（`予算No`, `年度`, `拠点`）をHTMLとして画面に出力する際、悪意あるスクリプトの実行（クロスサイトスクリプティング: XSS）を防ぐため、専用のエスケープ関数（`escapeHtml`）を通してHTMLエンティティに変換します。

### エスケープ置換テーブル

| 置換前文字 | 置換後エンティティ | 説明 |
| :---: | :---: | :--- |
| `&` | `&amp;` | アンパサンド |
| `<` | `&lt;` | 不等号（より小さい） |
| `>` | `&gt;` | 不等号（より大きい） |
| `"` | `&quot;` | ダブルクォーテーション |
| `'` | `&#39;` | シングルクォーテーション |

---

## 6. プログラムソースコード

本仕様書に基づき実装されたコードは以下を参照してください。
- ファイルパス: [budget_achievement.js](file:///z:/kintone/src/課題/budget_achievement.js)

---

## 7. 初学者向け・専門家による実装解説

本プログラムに組み込まれている実装パターンについて、JavaScriptおよびkintoneカスタマイズ開発のプロフェッショナルが実務的な観点から詳しく解説します。初学者が実務で堅牢なコードを書くための重要なエッセンスが詰まっています。

### 7.1. 即時関数 `(function() { ... })()` と `'use strict';` の意味
JavaScriptファイルを読み込む際、プログラムを即時関数で包んでいます。これには以下の非常に重要な意味があります。
* **スコープの汚染防止（競合回避）:** 
  kintone上では、複数のカスタマイズJavaScriptやプラグイン、kintoneシステム本体のスクリプトが同時に動作しています。即時関数で括ることで、変数やクラス定義がグローバル空間（`window` オブジェクト）に漏れ出すのを防ぎ、他のスクリプトとの競合・誤動作を完全に防止します。
* **`'use strict';`（厳格モード）の適用:** 
  JavaScriptの古いルーズな記述方法を禁止し、実行エラーを厳密にチェックするモードです。例えば、宣言していない変数の使用を防いだり、安全でない記述を制限することで、予期せぬサイレントバグを事前に防ぎます。

### 7.2. kintoneのライフサイクルとDOMレンダリングの罠
kintoneの `app.record.index.show` イベントは、単に「最初のページロード時」だけでなく、以下のようなタイミングでも再発火します。
1. 一覧画面の改ページ（ページネーション移動）
2. レコードのソート順の変更
3. 絞り込み条件の適用

kintoneはSPA（Single Page Application）的な動きをするため、これらの操作時にブラウザ全体の再読み込み（リロード）は発生せず、**内部のDOM（`div#customize`など）だけが書き換えられてイベントが再実行**されます。
* **プロのアドバイス:** 
  イベントの再発火のたびに毎回HTML全体を再構築・再適用（`container.innerHTML = html`）する設計にしておくことで、ページ移動やソートを行っても画面表示が壊れず、常に正しくデータが追従する堅牢な動作を担保できます。

### 7.3. クロスサイトスクリプティング (XSS) 対策の必然性
今回のプログラムでは、ユーザーが入力したテキスト（`予算No`, `年度`, `拠点`）を表示する際に必ず `HtmlUtil.escape()` を通しています。
* **なぜ必要なのか？**
  もしユーザーが拠点名フィールドに `<script>alert('XSS')</script>` と入力していた場合、エスケープせずに直接 `innerHTML` へ流し込むと、HTMLタグとして解釈されブラウザ上で悪意あるスクリプトが実行されてしまいます。
* **対策:** 
  `<` や `>` といった特殊文字を `&lt;` や `&gt;` などの「ただの文字（実体参照）」に変換（無害化）することで、意図しないスクリプト実行（XSS脆弱性）を完全に防御します。実務では必須のセキュリティ対策です。

### 7.4. 実務で必須の「防御的プログラミング」（ゼロ除算ガード）
達成率の計算において、以下のように予算が `0` より大きい場合のみ計算する判定を入れています。
```javascript
if (this.budget <= 0) { return 0; }
```
* **なぜ必要なのか？**
  新規登録時に予算が未入力（値が `0` や空）のレコードが存在した場合、JavaScriptで `100,000 / 0` のように `0` で割る計算をすると、プログラムはクラッシュしませんが、結果として `Infinity`（無限大）や `NaN`（非数）を返します。これがそのまま画面の表に表示されると、見栄えが悪くなるばかりか、画面全体の表示崩れや動作不良の原因になります。
* **対策:** 
  異常値や未入力データが入ってきてもシステムが破綻しないよう、事前に条件分岐で処理を分岐させる手法を**「防御的プログラミング」**と呼びます。

### 7.5. SOLID原則（オブジェクト指向）を適用する理由
今回のリファクタリングでは、初心者によくある「すべてのコードを一つの関数内にべた書きする」方法から、役割（責務）ごとにクラスを分ける「SOLID原則」に基づいた設計に変更しました。

* **保守性（修正のしやすさ）:**
  例えば、「警告色の文字を赤から黄色に変えたい」という要望があった場合、全体のHTML描画処理を読み解く必要はなく、`BudgetWarningRule` クラスの `getWarningClass()` メソッドだけを変更すれば完了します。他のコードに影響を与えないため、バグが混入する確率が極めて低くなります。
* **可読性（読みやすさ）:**
  クラス名（`HtmlUtil`, `TableViewRenderer` など）がそのままそのプログラムの役割を示しているため、数か月後に他の開発者がコードを見た際にも、どこに何が書かれているかを瞬時に理解できます。
* **拡張性（機能追加のしやすさ）:**
  「達成率80%未満は赤、90%未満は黄色にしたい」という多段階の警告ルールに変更する場合も、既存の描画ロジックに影響を与えることなく、新しい警告ルールクラスを作成してコントローラーに注入するだけで機能拡張が可能です。
