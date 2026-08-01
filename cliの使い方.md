cli-kintone record export --base-url https://kazu-lab.cybozu.com --app 11 --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" > records.csv


cli-kintone record export --base-url https://kazu-lab.cybozu.com --app 11 --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" --encoding sjis >Z:\kintone\records.csv



Ran command: `cli-kintone record export --base-url https://kazu-lab.cybozu.com --app 11 --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" --encoding sjis >Z:\kintone\records.csv`
Ran command: `cli-kintone record export --base-url https://kazu-lab.cybozu.com --app 11 --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" --encoding sjis >Z:\kintone\records.csv`
Edited cli%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9.md
Viewed kintonapi%E3%82%92%E5%88%A9%E7%94%A8%E3%81%97%E3%81%9F%E3%83%AC%E3%82%B3%E3%83%BC%E3%83%89%E6%83%85%E5%A0%B1%E5%8F%96%E5%BE%97.js:17-18

`--condition`（絞り込み条件）と `--order-by`（並び順）を指定した `cli-kintone record export` のコマンド例をご紹介します。

---

### 基本構文
```powershell
cli-kintone record export `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --condition "クエリ条件式" `
  --order-by "フィールドコード asc|desc" `
  --encoding sjis > Z:\kintone\records_filtered.csv
```

---

### 実用例

#### 例1：特定条件で絞り込んで、降順（新しい順）で並べ替える
顧客ランクが「A」のレコードのみを絞り込み、レコード番号の降順（新しい順）で取得する例：

```powershell
cli-kintone record export `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --condition '顧客ランク in ("A")' `
  --order-by 'レコード番号 desc' `
  --encoding sjis > Z:\kintone\records_rankA.csv
```

#### 例2：複数の条件（AND）と複数の並び順を指定する
都道府県が「神奈川県」かつ、締日「10日」のレコードを絞り込み、会社名の昇順（あいうえお順）で並べ替える例：

```powershell
cli-kintone record export `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --condition '都道府県 in ("神奈川県") and 締め日 in ("10日")' `
  --order-by '会社名 asc' `
  --encoding sjis > Z:\kintone\records_kanagawa.csv
```

#### 例3：日付条件で絞り込む
作成日時が 2026年7月1日以降のレコードを取得し、作成日時の昇順（古い順）で並べ替える例：

```powershell
cli-kintone record export `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --condition '作成日時 >= "2026-07-01T00:00:00Z"' `
  --order-by '作成日時 asc' `
  --encoding sjis > Z:\kintone\records_july.csv
```

---

### 指定時のポイント

- **`--condition` の書き方**: kintoneのクエリ記法に従います。文字列や選択肢の値はダブルクォーテーション `"` で囲みます。
  - イコール検索: `フィールドコード = "値"` または `フィールドコード in ("値")`
  - 部分一致: `フィールドコード like "キーワード"`
- **`--order-by` の書き方**: `フィールドコード asc`（昇順）または `フィールドコード desc`（降順）を指定します。複数指定する場合はカンマ区切り（例: `'顧客ランク asc, レコード番号 desc'`）が可能です。


旅費
https://kazu-lab.cybozu.com/k/admin/app/apitoken?app=17
Bg89VVLcnkOD7cP0AEwAvaMMZnuDXpZJARRDKphx

cli-kintone record export --app 17 --base-url https://kazu-lab.cybozu.com --api-token "Bg89VVLcnkOD7cP0AEwAvaMMZnuDXpZJARRDKphx" > Z:\kintone\ryohi.csv

---
cli-kintone record import `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --file-path Z:\kintone\add_customers.csv `
  --encoding sjis

cli-kintone record import `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --file-path Z:\kintone\add_customers.csv `
  --encoding sjis



cli-kintone record import `
  --base-url https://kazu-lab.cybozu.com `
  --app 11 `
  --api-token "I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H" `
  --file-path Z:\kintone\update_customers.csv `
  --encoding sjis `
  --update-key "顧客No"