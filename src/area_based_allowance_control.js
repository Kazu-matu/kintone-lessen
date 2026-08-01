(() => {
  'use strict';
  // 制御に利用するドロップダウンのフィールドコード
  const areaFieldCode = '地域';
  // 編集不可にするフィールドのフィールドコード
  const wageFieldCode = '日当';

  kintone.events.on([
    'app.record.create.show',
    'app.record.edit.show',
    `app.record.edit.change.${areaFieldCode}`,
    `app.record.create.change.${areaFieldCode}`
  ], (event) => {
    const record = event.record;

    switch (record[areaFieldCode].value) {
      case '首都圏':
        // 首都圏の場合は日当を0に設定し、編集不可にする
        record[wageFieldCode].value = '0';
        record[wageFieldCode].disabled = true;
        break;
      case '海外':
        // 海外の場合は日当を3000に設定し、編集不可にする
        record[wageFieldCode].value = '3000';
        record[wageFieldCode].disabled = true;
        break;
      case 'その他':
        // その他の場合は日当を編集可能にする
        record[wageFieldCode].disabled = false;
        break;
      default:
        // 未選択 or 上記以外は日当を1000に設定し、編集不可にする
        record[wageFieldCode].value = '1000';
        record[wageFieldCode].disabled = true;
        break;
    }

    return event;
  });
})();