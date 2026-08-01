"""
kintone REST API を利用して「商品リスト」アプリ(appId=16)のレコードを取得するスクリプト。

事前準備:
    pip install requests pandas

必要な環境変数(既存のKintone MCP Serverと同じ変数名を利用しています):
    KINTONE_BASE_URL       例: https://kazu-lab.cybozu.com  (先頭は https:// から)
    KINTONE_USERNAME       ログインID(例: kazufumi0707@gmail.com) ※パスワード認証の場合
    KINTONE_PASSWORD       ログインパスワード                    ※パスワード認証の場合
    KINTONE_API_TOKEN      APIトークン                          ※APIトークン認証の場合(こちらを推奨)

認証方式は KINTONE_API_TOKEN が設定されていればそちらを優先し、
なければ KINTONE_USERNAME / KINTONE_PASSWORD によるパスワード認証を使用します。

使い方:
    python get_kintone_records.py                         # products.csv に出力
    python get_kintone_records.py --app-id 16 --out out.csv
"""

import argparse
import base64
import json
import os
import sys

import pandas as pd
import requests


def build_headers(base_url: str) -> dict:
    """認証方式に応じたヘッダーを組み立てる"""
    api_token = os.environ.get("KINTONE_API_TOKEN", "").strip()
    username = os.environ.get("KINTONE_USERNAME", "").strip()
    password = os.environ.get("KINTONE_PASSWORD", "").strip()

    headers = {"Content-Type": "application/json"}

    if api_token:
        headers["X-Cybozu-API-Token"] = api_token
    elif username and password:
        token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("utf-8")
        headers["X-Cybozu-Authorization"] = token
    else:
        sys.exit(
            "エラー: 認証情報が見つかりません。"
            "KINTONE_API_TOKEN か、KINTONE_USERNAME/KINTONE_PASSWORD を環境変数に設定してください。"
        )

    return headers


def fetch_all_records(base_url: str, app_id: str, headers: dict, fields: list | None = None) -> list:
    """100件ずつページングしながら全レコードを取得する"""
    url = f"{base_url.rstrip('/')}/k/v1/records.json"
    all_records = []
    offset = 0
    limit = 100

    while True:
        query = f"limit {limit} offset {offset}"
        params = {"app": app_id, "query": query}
        if fields:
            params["fields"] = fields

        resp = requests.get(url, headers=headers, params=params)

        if resp.status_code != 200:
            sys.exit(f"エラー: APIリクエストに失敗しました ({resp.status_code})\n{resp.text}")

        data = resp.json()
        records = data.get("records", [])
        all_records.extend(records)

        if len(records) < limit:
            break
        offset += limit

    return all_records


def records_to_dataframe(records: list) -> pd.DataFrame:
    """kintoneのレコード形式(各フィールドが {"value": ..., "type": ...})を
    フィールドコード列 = 値 のシンプルなDataFrameに変換する"""
    if not records:
        return pd.DataFrame()

    rows = []
    for record in records:
        row = {}
        for field_code, field_data in record.items():
            value = field_data.get("value", "")
            # サブテーブルやチェックボックスなど、値がリスト/dictの場合はJSON文字列化しておく
            if isinstance(value, (list, dict)):
                value = json.dumps(value, ensure_ascii=False)
            row[field_code] = value
        rows.append(row)

    return pd.DataFrame(rows)


def save_as_csv(df: pd.DataFrame, out_path: str) -> None:
    """DataFrameをCSVとして保存する(Excelでの文字化けを避けるためutf-8-sig)"""
    if df.empty:
        print("レコードが0件のため、CSVは作成しませんでした。")
        return

    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"CSVを保存しました: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="kintoneの商品リストアプリからレコードを取得します")
    parser.add_argument("--app-id", default="16", help="kintoneアプリID(デフォルト: 16 = 商品リスト)")
    parser.add_argument("--out", default="products.csv", help="CSV出力先パス(デフォルト: products.csv)")
    args = parser.parse_args()

    base_url = os.environ.get("KINTONE_BASE_URL", "").strip()
    if not base_url:
        sys.exit("エラー: 環境変数 KINTONE_BASE_URL が設定されていません(例: https://kazu-lab.cybozu.com)")

    headers = build_headers(base_url)
    records = fetch_all_records(base_url, args.app_id, headers)

    print(f"取得件数: {len(records)} 件")

    df = records_to_dataframe(records)
    print(df.head())

    save_as_csv(df, args.out)


if __name__ == "__main__":
    main()