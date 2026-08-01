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