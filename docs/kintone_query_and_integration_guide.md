<!--
 * 課題名: kintoneクエリ制限とアプリ間データ結合手法の調査
 * 版数: 1.0.0
 * 作成日: 2026-08-02
 * 更新日: 2026-08-02
 * 作成者: Antigravity
 * 修正者: Antigravity
 * ツール: Antigravity
 -->

# kintone クエリ制限とアプリ間データ結合（JOIN）手法ガイド

本ドキュメントは、kintoneにおけるレコード取得API의クエリ制限事項、およびRDBにおける `RIGHT JOIN` / `LEFT JOIN` に相当するアプリ間のデータ結合（統合）を実現するための具体的な代替手法についてまとめたものです。

---

## 1. kintone レコード取得APIのクエリ制限と上限値

kintoneの複数のレコードを取得するAPI（`GET /k/v1/records.json`）およびクエリ（`query` パラメーター）の利用には、以下の制限事項と上限値が存在します。

| 制限項目 | 上限値 / 挙動 | 補足・回避策 |
| :--- | :--- | :--- |
| **レコード取得件数 (`limit`)** | 最大 **500 件** | 省略した場合はデフォルトで **100 件** が適用されます。※一部の別APIでは上限100件のものもあります。 |
| **スキップ件数 (`offset`)** | 最大 **10,000 件** | 10,000件を超えるデータを取得する場合は、**「カーソルAPI (`/k/v1/records/cursor.json`)」** の使用が推奨されます。 |
| **キーワード検索 (`like` / `not like`)** | 最大 **100,000 件** で検索打ち切り | ヒット件数が上限に達すると処理が打ち切られ、レスポンスヘッダー `X-Cybozu-Warning` に警告が追加されます。 |
| **URLの長さ (GET時)** | 約 **8 KB**（サーバー・プロキシ依存） | 長大なクエリを指定してURL長の上限を超えると `414 Request-URI Too Large` になります。**リクエストボディにJSONで指定** するか、`X-HTTP-Method-Override: GET` を指定した `POST` リクエストで回避します。 |
| **クエリの複雑さ** | 複雑すぎるとエラー (`GAIA_TM01`) | 条件式が極端に多い場合、「レコードの絞り込み条件が多すぎます」とエラーになります。クエリの分割取得などで対処します。 |
| **フィールドによる演算子制限** | テーブル内・関連レコードは `=` / `!=` 不可 | テーブル内フィールドや関連レコードをクエリに含める場合は、**`in`** または **`not in`** を使用します。 |
| **ソートの制限 (`order by`)** | 一部フィールドでソート不可 | 添付ファイル、文字列（複数行）、リッチエディター、テーブル内フィールド、関連レコードなどはソートキーに指定できません。 |
| **特殊文字のエスケープ** | `"` と `\` を含む値 | 値にダブルクォーテーションやバックスラッシュを含む場合は、`\"` や `\\` としてエスケープが必要です。 |

---

## 2. kintone アプリ間でのデータ結合（JOIN）の実現手法

kintoneの標準機能およびAPIには、RDB（リレーショナルデータベース）のような `JOIN` 構文がありません。そのため、アプリ間でデータを結合して抽出・表示する場合は、以下の代替手段を検討します。

### 2.1. kintone 標準機能（画面連携）
データをAPIで一括抽出するのではなく、ユーザーが画面上で紐付けてデータを確認したい場合に適しています。
*   **関連レコード一覧機能:** 
    マスタアプリ側に「関連レコード一覧」フィールドを配置し、紐付け条件（例: 商品コードが一致する）を指定してトランザクションアプリのレコードを表示します。マスタを起点としてトランザクションを結合表示する、`RIGHT OUTER JOIN` に近いビューを表現できます。
*   **ルックアップ機能:**
    トランザクションアプリに入力する際、マスタアプリのデータをコピーして保持します。

### 2.2. M言語（Power Query）による取得と結合
ExcelやPower BIにデータを取り込み、そこで結合（マージ）を行う手法です。

#### 取得・結合フロー
1.  マスタアプリ、トランザクションアプリそれぞれから API（`GET /k/v1/records.json`）を叩き、テーブルとして読み込む。
2.  Power Queryの「クエリのマージ」を使用し、マスタのキーとトランザクションのキーで結合する。
3.  結合の種類として「左外部」（マスタが主軸の場合）を指定する。

#### kintoneデータ取得のM言語コード基本例
```powerquery
let
    Subdomain = "あなたのサブドメイン",
    AppId = "アプリID",
    ApiToken = "APIトークン",
    
    Url = "https://" & Subdomain & ".cybozu.com/k/v1/records.json?app=" & AppId & "&limit=500",
    Source = Json.Document(Web.Contents(Url, [Headers=[#"X-Cybozu-API-Token"=ApiToken]])),
    records = Source[records],
    TableConversion = Table.FromList(records, Splitter.SplitByNothing(), null, null, ExtraValues.Error),
    ExpandedColumn = Table.ExpandRecordColumn(TableConversion, "Column1", {"レコード番号", "商品コード", "売上金額"}, {"レコード番号", "商品コード", "売上金額"})
in
    ExpandedColumn
```
*※ 500件を超えるデータを処理する場合は、M言語のカスタム関数を用いて `offset` をループ（再帰取得）させる処理が必要です。*

### 2.3. Python + Pandas による取得と結合
プログラムによるデータ処理が可能な環境において、最も柔軟かつ容易に `RIGHT JOIN` / `LEFT JOIN` を実現できる推奨手法です。

*   **メリット:**
    *   500件制限を回避するための `while` ループによるページネーションがシンプルに書ける。
    *   `pd.merge(how="right")` で直感的に結合処理ができる。
    *   Excel出力（`.to_excel()`）やデータベース転送、別アプリへの書き戻しなど後続処理が豊富。

#### Pythonスクリプト例
```python
import pandas as pd
import requests


def get_all_kintone_records(subdomain, app_id, api_token):
    """500件制限を自動で回避して全レコードをフラットなDataFrameとして取得する関数"""
    offset = 0
    limit = 500
    all_records = []
    headers = {"X-Cybozu-API-Token": api_token}

    while True:
        url = f"https://{subdomain}.cybozu.com/k/v1/records.json"
        params = {"app": app_id, "limit": limit, "offset": offset}

        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()

        records = response.json().get("records", [])
        if not records:
            break

        all_records.extend(records)
        if len(records) < limit:
            break

        offset += limit

    # kintoneのネストされたデータ構造をフラット化
    flat_records = []
    for r in all_records:
        flat_records.append({key: val["value"] for key, val in r.items()})

    return pd.DataFrame(flat_records)


# 1. データの取得
SUBDOMAIN = "あなたのサブドメイン"
df_master = get_all_kintone_records(
    SUBDOMAIN, "マスタアプリID", "マスタアプリトークン"
)
df_trans = get_all_kintone_records(
    SUBDOMAIN, "トランザクションアプリID", "トランザクションアプリトークン"
)

# 2. RIGHT JOIN（マスタを主軸に結合）
# マスタ「df_master」をベースに、トランザクション「df_trans」を結合する
df_joined = pd.merge(df_trans, df_master, on="商品コード", how="right")

# 3. Excel等への出力
df_joined.to_excel("kintone_joined_data.xlsx", index=False)
```

### 2.4. サードパーティ製品・プラグインの活用
ノンプログラミングでアプリ間のデータ結合（JOIN）を自動化したい場合に最適です。
*   **krewData (グレープシティ社):**
    kintoneアプリ同士のデータを結合（ルックアップに頼らない結合）、集計、絞り込み、別アプリへの自動出力をGUI上のフローで設定・スケジュール実行できる、最も人気のあるデータ加工プラグインです。
