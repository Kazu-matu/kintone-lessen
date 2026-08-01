# **kintone商品リスト取得バッチ 仕様書**

対象スクリプト: `get_kintone_records.py`

## **1\. 概要**

kintone REST APIを利用して、指定したkintoneアプリ(デフォルト: 「商品リスト」appId=16)の全レコードを取得し、pandas DataFrameに変換したうえでCSVファイルとして出力するバッチスクリプトである。

## **2\. 実行環境・前提条件**

| 項目 | 内容 |
| :---- | :---- |
| 言語 | Python 3.10以上(`list | None` 記法を使用) |
| 主要ライブラリ | `requests`, `pandas` |
| 認証方式 | APIトークン認証 または パスワード(Basic)認証 |
| ページング | 100件単位で全件取得するまで自動継続 |

## **3\. 環境変数一覧**

| 変数名 | 必須 | 用途 |
| :---- | :---- | :---- |
| `KINTONE_BASE_URL` | 必須 | kintoneのベースURL(例: `https://kazu-lab.cybozu.com`) |
| `KINTONE_API_TOKEN` | 任意 | APIトークン認証を使う場合に設定。設定時はこちらが優先される |
| `KINTONE_USERNAME` | 任意 | パスワード認証時のログインID |
| `KINTONE_PASSWORD` | 任意 | パスワード認証時のパスワード |

## **4\. コマンドライン引数**

| 引数 | デフォルト | 内容 |
| :---- | :---- | :---- |
| `--app-id` | `16` | 取得対象のkintoneアプリID |
| `--out` | `products.csv` | CSV出力先パス |

## **5\. 関数一覧**

| 関数名 | 役割 |
| :---- | :---- |
| `build_headers(base_url)` | 環境変数から認証情報を読み、APIリクエスト用ヘッダーを組み立てる |
| `fetch_all_records(base_url, app_id, headers, fields)` | kintone REST APIを100件ずつページングしながら呼び出し、全レコードを取得する |
| `records_to_dataframe(records)` | kintoneのレコード形式(`{フィールドコード: {"value": ...}}`)をDataFrameに変換する |
| `save_as_csv(df, out_path)` | DataFrameをUTF-8(BOM付き)CSVとして保存する |
| `main()` | 上記関数を順に呼び出すバッチ処理全体の制御 |

## **6\. main関数のバッチ処理フロー**

flowchart TD

    A(\[開始 main\]) \--\> B\[コマンドライン引数を解析\<br/\>app-id / out\]

    B \--\> C{KINTONE\_BASE\_URL\<br/\>が設定されているか}

    C \-- 未設定 \--\> C1\[エラーメッセージを表示して終了\]

    C \-- 設定済み \--\> D\[build\_headers を呼び出し\<br/\>認証ヘッダーを作成\]

    D \--\> E{KINTONE\_API\_TOKEN\<br/\>が設定されているか}

    E \-- あり \--\> E1\[X-Cybozu-API-Token\<br/\>ヘッダーを設定\]

    E \-- なし \--\> F{USERNAME/PASSWORD\<br/\>が両方設定されているか}

    F \-- あり \--\> F1\[Base64エンコードして\<br/\>X-Cybozu-Authorization\<br/\>ヘッダーを設定\]

    F \-- なし \--\> F2\[エラーメッセージを表示して終了\]

    E1 \--\> G\[fetch\_all\_records を呼び出し\]

    F1 \--\> G

    G \--\> H\[\[レコード取得ループ\<br/\>offset=0, limit=100\]\]

    H \--\> I\[GET /k/v1/records.json\<br/\>query: limit/offset\]

    I \--\> J{HTTPステータス\<br/\>200か}

    J \-- No \--\> J1\[エラーメッセージを表示して終了\]

    J \-- Yes \--\> K\[取得したrecordsを\<br/\>全件リストに追加\]

    K \--\> L{取得件数 \< limit}

    L \-- No \--\> M\[offset \+= limit\]

    M \--\> H

    L \-- Yes \--\> N\[全レコード取得完了\]

    N \--\> O\[取得件数を標準出力に表示\]

    O \--\> P\[records\_to\_dataframe を呼び出し\<br/\>DataFrameに変換\]

    P \--\> Q\[df.head を標準出力に表示\<br/\>プレビュー\]

    Q \--\> R\[save\_as\_csv を呼び出し\<br/\>CSVファイルとして保存\]

    R \--\> S(\[終了\])

## **7\. レコード → DataFrame 変換ロジック**

flowchart TD

    A(\[records\_to\_dataframe 開始\]) \--\> B{records は空か}

    B \-- Yes \--\> B1\[空のDataFrameを返す\]

    B \-- No \--\> C\[各レコードについてループ\]

    C \--\> D\[レコード内の各フィールドについてループ\]

    D \--\> E{値がlist型\<br/\>またはdict型か}

    E \-- Yes \--\> E1\[JSON文字列に変換\<br/\>サブテーブル/チェックボックス対策\]

    E \-- No \--\> F\[値をそのまま使用\]

    E1 \--\> G\[行データに\<br/\>フィールドコード: 値 を格納\]

    F \--\> G

    G \--\> H{全フィールド\<br/\>処理済みか}

    H \-- No \--\> D

    H \-- Yes \--\> I\[行データをrows配列に追加\]

    I \--\> J{全レコード\<br/\>処理済みか}

    J \-- No \--\> C

    J \-- Yes \--\> K\[rowsからDataFrameを生成\]

    K \--\> L(\[DataFrameを返す\])

## **8\. エラーハンドリング一覧**

| 発生条件 | 挙動 |
| :---- | :---- |
| `KINTONE_BASE_URL` 未設定 | エラーメッセージを表示し `sys.exit` で終了 |
| 認証情報(APIトークンもUSERNAME/PASSWORDも)が未設定 | エラーメッセージを表示し `sys.exit` で終了 |
| APIリクエストが200以外を返す | ステータスコードとレスポンス本文を表示し `sys.exit` で終了 |
| 取得レコードが0件 | CSVファイルは作成せず、その旨をメッセージ表示 |

## **9\. 出力**

- 標準出力: 取得件数、DataFrameの先頭5行のプレビュー  
- ファイル出力: `--out` で指定したパスにCSV(文字コード: UTF-8 with BOM、Excelでの文字化け対策)

## **10\. 今後の拡張候補(未実装)**

- `.env` ファイル \+ `python-dotenv` によるパスワード管理の改善  
- 特定フィールドのみ取得する `fields` オプションのCLI対応  
- Excel(.xlsx)出力オプション

