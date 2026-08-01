(() => {
  'use strict';

  kintone.events.on('app.record.index.show', (event) => {
    const records = event.records;
    const fieldCode = 'ステータス';

    // フィールドコードが「ステータス」のフィールド要素を取得
    const elements = kintone.app.getFieldElements(fieldCode);

    elements.forEach((element, i) => {
      // 何行目のレコードかを表す配列のインデックス番号を使って、レコードの値を取得する
      const record = records[i];
      const statusFieldValue = record[fieldCode].value;

      // ステータスフィールドの値によって、背景色を変更する
      switch (statusFieldValue) {
        case '未着手':
          // 赤色にする
          element.style.backgroundColor = '#ff0000';
          break;
        case '処理中':
          // 青色にする
          element.style.backgroundColor = '#0000ff';
          break;
        case '依頼者確認中':
          // 黄色にする
          element.style.backgroundColor = '#ffff00';
          break;
        case '完了':
          // 緑色にする
          element.style.backgroundColor = '#00ff00';
          break;
        default:
          break;
      }
    });

    return event;
  });
})();