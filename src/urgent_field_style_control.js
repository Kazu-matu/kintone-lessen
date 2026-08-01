(() => {
  'use strict';

  kintone.events.on('app.record.detail.show', (event) => {
    const record = event.record;
    const fieldCode = 'Urgent';

    // フィールドコードが「Urgent」のフィールド要素を取得
    const element = kintone.app.record.getFieldElement(fieldCode);
    // フィールドコードが「Urgent」のフィールドの値を取得
    const urgentFieldValue = record[fieldCode].value;
    // チェックボックスフィールドは配列で値が返ってくるため、至急が含まれているかを確認する
    const hasUrgent = urgentFieldValue.includes('至急');

    if (hasUrgent) {
      // 文字色を赤色にする
      element.style.color = '#ff0000';
      // 太文字にする
      element.style.fontWeight = 'bold';
    }

    return event;
  });
})();