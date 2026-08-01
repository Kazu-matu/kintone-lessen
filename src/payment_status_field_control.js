(() => {
  'use strict';
  // 制御に利用するラジオボタンのフィールドコード
  const statusFieldCode = '入金ステータス';
  // 表示非表示を切り替えるフィールドのフィールドコード
  const fieldCodes = ['入金日', '入金確認者'];

  // 「入金ステータス」フィールドによって、特定のフィールドの表示／非表示を切り替える
  kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show',
    `app.record.create.change.${statusFieldCode}`,
    `app.record.edit.change.${statusFieldCode}`
  ], (event) => {
    const record = event.record;
    const statusFieldValue = record[statusFieldCode].value;
    fieldCodes.forEach((fieldCode) => {
      if (statusFieldValue === '確認済') {
        kintone.app.record.setFieldShown(fieldCode, true);
      } else {
        kintone.app.record.setFieldShown(fieldCode, false);
      }
    });

    return event;
  });
})();