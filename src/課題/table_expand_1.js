/**
 * 課題名: CN-057-9-1 サブテーブル展開#1（新規一括登録）
 * 版数: 1.0.5
 * 作成日: 2026-08-02
 * 更新日: 2026-08-05
 * 作成者: Antigravity
 * 修正者: Antigravity
 * ツール: Antigravity
 */
(function () {
  'use strict';

  // 転送先「受注明細」アプリのID
  const DETAIL_APP_ID = 24;

  /**
   * レコード詳細画面が表示されたときに実行されるイベントハンドラ。
   * 詳細画面に「テーブル展開#1」ボタンを設置します。
   * 
   * @param {Object} event kintoneのイベントオブジェクト
   * @returns {Object} イベントオブジェクト
   */
  kintone.events.on('app.record.detail.show', function (event) {
    const record = event.record;

    // ヘッダーメニュー領域の取得
    const headerMenuEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!headerMenuEl || document.getElementById('btn_table_expand_1')) {
      return event; // すでにボタンが存在する場合は何もしない
    }

    // ボタンエレメントの生成とスタイリング
    const btn = document.createElement('button');
    btn.id = 'btn_table_expand_1';
    btn.innerText = 'テーブル展開#1';
    btn.className = 'kintoneplugin-button-normal';
    btn.style.margin = '10px';

    /**
     * ボタンがクリックされたときに実行される非同期処理。
     * サブテーブルのデータを取得し、受注明細アプリへ一括登録（POST）します。
     * 
     * @returns {Promise<void>}
     */
    btn.addEventListener('click', async function () {
      // サブテーブルの取得
      const subtable = record.受注明細Table ? record.受注明細Table.value : [];
      if (!subtable || subtable.length === 0) {
        alert('展開対象の明細行（サブテーブル）が存在しません。');
        return;
      }

      /**
       * サブテーブルの各行から受注明細アプリ用の登録データを生成するコールバック関数。
       * 
       * @param {Object} row サブテーブルの1行分のデータ
       * @returns {Object} 登録用レコードオブジェクト
       */
      const recordsToPost = subtable.map(function (row) {
        return {
          '受注番号': { value: record.受注管理No.value },
          '受注日': { value: record.受注日.value },
          '顧客コード': { value: record.顧客コード.value },
          '商品コード_0': { value: row.value.商品コード.value },
          'カテゴリ': { value: row.value.カテゴリ.value },
          '商品名': { value: row.value.商品名.value },
          '単価': { value: row.value.販売単価.value },
          '数量': { value: row.value.数量.value },
          '小計': { value: row.value.小計.value }
        };
      });

      // API実行と例外処理
      try {
        // kintone REST APIで一括登録(POST)
        const resp = await kintone.api(
          kintone.api.url('/k/v1/records.json', true),
          'POST',
          { app: DETAIL_APP_ID, records: recordsToPost }
        );

        alert('受注明細アプリへ ' + resp.ids.length + ' 件の明細展開登録が完了しました！');
      } catch (err) {
        console.error('明細展開エラー:', err);
        alert('エラーが発生しました: ' + (err.message || JSON.stringify(err)));
      }
    });

    // ヘッダーエリアにボタンを追加
    headerMenuEl.appendChild(btn);
    return event;
  });
})();
