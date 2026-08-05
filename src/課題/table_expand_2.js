/**
 * 課題名: CN-058-9-2 明細登録 ＆ 明細番号（採番ID）の親テーブル反映
 * 版数: 1.0.5
 * 作成日: 2026-08-02
 * 更新日: 2026-08-05
 * 作成者: Antigravity
 * 修正者: Antigravity
 * ツール: Antigravity
 */
(function() {
  'use strict';

  // 転送先「受注明細」アプリのID
  const DETAIL_APP_ID = 24;

  /**
   * レコード詳細画面が表示されたときに実行されるイベントハンドラ。
   * 詳細画面に「テーブル展開#2」ボタンを設置します。
   * 
   * @param {Object} event kintoneのイベントオブジェクト
   * @returns {Object} イベントオブジェクト
   */
  kintone.events.on('app.record.detail.show', function(event) {
    const record = event.record;

    const headerMenuEl = kintone.app.record.getHeaderMenuSpaceElement();
    if (!headerMenuEl || document.getElementById('btn_table_expand_2')) {
      return event;
    }

    const btn = document.createElement('button');
    btn.id = 'btn_table_expand_2';
    btn.innerText = 'テーブル展開#2';
    btn.className = 'kintoneplugin-button-normal';
    btn.style.margin = '10px';

    /**
     * ボタンがクリックされたときに実行される非同期処理。
     * サブテーブルのデータを取得し、受注明細アプリへの一括登録(POST)後、
     * 発行されたID群を親レコードのサブテーブルへ書き戻し更新(PUT)します。
     * 
     * @returns {Promise<void>}
     */
    btn.addEventListener('click', async function() {
      const subtable = record.受注明細Table ? record.受注明細Table.value : [];
      if (!subtable || subtable.length === 0) {
        alert('展開対象の明細行が存在しません。');
        return;
      }

      /**
       * サブテーブルの各行から受注明細アプリ用の登録データを生成するコールバック関数。
       * 
       * @param {Object} row サブテーブルの1行分のデータ
       * @returns {Object} 登録用レコードオブジェクト
       */
      const recordsToPost = subtable.map(function(row) {
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

      try {
        // Step 1: 明細アプリに新規一括登録 (POST) を待機
        const resp = await kintone.api(
          kintone.api.url('/k/v1/records.json', true),
          'POST',
          { app: DETAIL_APP_ID, records: recordsToPost }
        );

        // 返却された明細レコードID群 (例: [101, 102])
        const postedIds = resp.ids;

        /**
         * 登録された明細レコードのIDを、対応するサブテーブル行の「受注明細番号」へ反映するコールバック関数。
         * 
         * @param {Object} row サブテーブルの1行分のデータ
         * @param {number} index インデックス番号
         * @returns {Object} 更新用サブテーブル行オブジェクト
         */
        const updatedTable = subtable.map(function(row, index) {
          return {
            id: row.id, // サブテーブル既存行の内部IDを維持
            value: Object.assign({}, row.value, {
              '受注明細番号': { value: String(postedIds[index]) }
            })
          };
        });

        // Step 3: 受注管理アプリ自体のレコードをPUT更新
        await kintone.api(
          kintone.api.url('/k/v1/record.json', true),
          'PUT',
          {
            app: kintone.app.getId(),
            id: kintone.app.record.getId(),
            record: { '受注明細Table': { value: updatedTable } }
          }
        );

        alert('受注明細の登録および受注明細番号の書き戻しが完了しました。');
        location.reload(); // 最新表示のために画面リロード
      } catch (err) {
        console.error('エラー発生:', err);
        alert('処理中にエラーが発生しました: ' + (err.message || JSON.stringify(err)));
      }
    });

    headerMenuEl.appendChild(btn);
    return event;
  });
})();
