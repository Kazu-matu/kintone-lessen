/**
 * 課題名: CN-058-9-2 明細登録 ＆ 明細番号（採番ID）の親テーブル反映
 * 版数: 1.0.0
 * 作成日: 2026-08-02
 * 更新日: 2026-08-02
 * 作成者: Antigravity
 * 修正者: Antigravity
 * ツール: Antigravity
 */
(function() {
  'use strict';

  // 転送先「受注明細」アプリのID
  const DETAIL_APP_ID = 12;

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

    btn.addEventListener('click', async function() {
      const subtable = record.Table ? record.Table.value : [];
      if (!subtable || subtable.length === 0) {
        alert('展開対象の明細行が存在しません。');
        return;
      }

      // 明細アプリへPOSTするデータ作成
      const recordsToPost = subtable.map(function(row) {
        return {
          '受注番号': { value: record.受注管理No.value },
          '受注日': { value: record.受注日.value },
          '顧客コード': { value: record.顧客コード.value },
          '商品コード': { value: row.value.商品コード.value },
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

        // Step 2: 親アプリのサブテーブル各行に採番された「受注明細番号」を付与
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
            record: { 'Table': { value: updatedTable } }
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
