https://kazu-lab.cybozu.com/k/admin/app/apitoken?app=5



たとえば、次の条件でレコードを取得する場合を考えます。

パラメーター	値
サブドメイン	sample
アプリID	5
レコードID	20
APIトークン	eaVYLrgxeblw1cgArgZlFdqPYTePwP8LsGOOp1QS
コマンドは次のとおりです。


```
curl -X GET -H 'X-Cybozu-API-Token:eaVYLrgxeblw1cgArgZlFdqPYTePwP8LsGOOp1QS' \
  'https://kazu-lab.cybozu.com/k/v1/record.json?app=5&id=20'

```

でも環境

demo-guest

0jiufoF7
---
顧客管理
PIトークン
I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H
id 11

```
 curl -X GET -H 'X-Cybozu-API-Token:I8oBusQKFR3qsX2joNBaoeQlJm3kDMqACJsWlu4H' \  'https://kazu-lab.cybozu.com/k/v1/record.json?app=11&id=2'

{"record":{"顧客No":{"type":"RECORD_NUMBER","value":"2"},"顧客情報メモ欄":{"type":"MULTI_LINE_TEXT","value":""},"更新者":{"type":"MODIFIER","value":{"code":"kazufumi0707@gmail.com","name":"松島和文"}},"作成者":{"type":"CREATOR","value":{"code":"kazufumi0707@gmail.com","name":"松島和文"}},"郵便番号":{"type":"SINGLE_LINE_TEXT","value":"221-xxxx"},"Webサイト":{"type":"LINK","value":"https://www.xxx.xxx"},"$revision":{"type":"__REVISION__","value":"1"},"建物名":{"type":"SINGLE_LINE_TEXT","value":"青葉橋本ビル"},"業種":{"type":"DROP_DOWN","value":"運輸・通信業"},"更新日時":{"type":"UPDATED_TIME","value":"2026-07-29T06:02:00Z"},"顧客ランク":{"type":"RADIO_BUTTON","value":"C"},"都道府県":{"type":"DROP_DOWN","value":"神奈川県"},"支払日":{"type":"DROP_DOWN","value":"翌月25日"},"住所":{"type":"SINGLE_LINE_TEXT","value":"横浜市青葉区xxx-xx-xx"},"締め日":{"type":"DROP_DOWN","value":"10日"},"電話番号":{"type":"LINK","value":"045-xxxx-xxxx"},"FAX":{"type":"LINK","value":"045-xxxx-xxxx"},"作成日時":{"type":"CREATED_TIME","value":"2026-07-29T06:02:00Z"},"会社名":{"type":"SINGLE_LINE_TEXT","value":"橋本ネットワーク通信株式会社"},"$id":{"type":"__ID__","value":"2"}}}
PS Z:\kintone>

```




```



---


### はじめに

帳票などを作成する際の便利な使い方について紹介します。  
フィールドの入力可、不可をチェックボックスやラジオボタンで制御したいという時はこんな使い方が便利です。  
  
kintoneではボタン選択時のイベントが取得できます。  
このイベントに合わせてフィールドを制御してみましょう。

### デモ環境

デモ環境で実際に動作を確認できます。  
[https://dev-demo.cybozu.com/k/169/](https://dev-demo.cybozu.com/k/169/)

ログイン情報は[cybozu developer networkデモ環境](https://cybozu.dev/ja/id/d149e606f6b6deee612013d2/)で確認してください。

### 入力欄を不可にした画面

 

 

フィールド値変更時イベントでの操作は、次のイベントタイプを指定します。

- レコード追加画面：`app.record.create.change.フィールドコード`
- レコード編集画面：`app.record.edit.change.フィールドコード`

以下は、イベントタイプの`フィールドコード`に指定可能なフィールドです。  
フィールドコードに存在するフィールドコード、かつ次の種類のフィールドを指定した場合のみハンドラーが実行されます。

- ラジオボタン
- ドロップダウン
- チェックボックス
- 複数選択
- ユーザー選択
- 日付
- 時刻
- 日時

#### 注意事項

- 存在しないフィールドコード、または上記の種類以外のフィールドを指定した場合は何も発生しません。
- 次のようなケースの場合には反映されません。
  - 編集権限のないフィールドの`value`を書き換えた場合
  - 編集権限のないフィールドの`disabled`を`true`に設定した場合

詳しくは[フィールドの編集可／不可を設定する](https://cybozu.dev/ja/id/073cb99467614b140b2a9c42/#record-list-enable-disable-field-edits)を参照してください。

### アプリの準備

以下のフィールドを配置したアプリを作成します。

|フィールドの種類|フィールド名|フィールドコード|
|:---|:---|:---|
|チェックボックス|チェックボックス|チェックボックス|
|文字列（1行）|文字列（1行）|文字列__1行_|
|ラジオボタン|ラジオボタン|ラジオボタン|
|文字列（複数行）|文字列（複数行）|文字列__複数行_|

チェックボックスフィールドの設定で、「有効にする場合はチェックしてください」を初期値として選択します。

### ソースコード

```js
/*
 * Control input filed example
 * Copyright (c) 2025 Cybozu
 *
 * Licensed under the MIT License
 * https://opensource.org/license/mit/
 */

(() => {
  'use strict';
  // チェックボックスのイベントを取得
  const cbEvents = [
    'app.record.create.change.チェックボックス',
    'app.record.edit.change.チェックボックス',
  ];
  kintone.events.on(cbEvents, (event) => {
    const record = event.record;

    // チェックボックスの入力値チェック
    if (record.チェックボックス.value[0] === '有効にする場合はチェックしてください') {
      // チェックなしの場合は"文字列__1行_"を有効にする
      record.文字列__1行_.disabled = false;
    } else {
      // チェックありの場合は"文字列__1行_"を無効にする
      record.文字列__1行_.disabled = true;
    }
    return event;
  });

  // ラジオボタンのイベントを取得
  const rbEvents = ['app.record.create.change.ラジオボタン', 'app.record.edit.change.ラジオボタン'];
  kintone.events.on(rbEvents, (event) => {
    const record = event.record;

    // ラジオボタンの入力値チェック
    if (record.ラジオボタン.value === '有効にする') {
      // ラジオボタンが"有効にする"を選択している場合
      record.文字列__複数行_.disabled = false;
    } else {
      // ラジオボタンが"無効にする"を選択している場合
      record.文字列__複数行_.disabled = true;
    }
    return event;
  });
})();
```

このTipsは、2025年7月版kintoneで動作を確認しています。

