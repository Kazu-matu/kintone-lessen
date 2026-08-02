/**
 * 課題名: CN-059-9-3 明細登録 ＆ 更新分岐処理（async/await + Promise.all版）
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

    const headerMenuEl = kintone.app.getHeaderMenuSpaceElement();
    if (!headerMenuEl || document.getElementById('btn_table_expand_3')) {
      return event;
    }

    const btn = document.createElement('button');
    btn.id = 'btn_table_expand_3';
    btn.innerText = 'テーブル展開#3';
    btn.className = 'kintoneplugin-button-normal';
    btn.style.margin = '10px';

    btn.addEventListener('click', async function() {
      const subtable = record.Table ? record.Table.value : [];
      if (!subtable || subtable.length === 0) {
        alert('展開対象の明細行が存在しません。');
        return;
      }

      // 新規作成行と既存更新行に分類
      const newRows = [];
      const updateRecords = [];

      subtable.forEach(function(row, index) {
        const detailNo = row.value.受注明細番号 ? row.value.受注明細番号.value : '';
        const payload = {
          '受注番号': { value: record.受注管理No.value },
          '受注日': { value: record.受注日.value },
          '顧客コード': { value: record.顧客コード.value },
          '商品コード': { value: row.value.商品コード.value },
          '数量': { value: row.value.数量.value },
          '小計': { value: row.value.小計.value }
        };

        if (detailNo) {
          // 受注明細番号がある場合 -> 既存更新
          updateRecords.push({
            id: detailNo,
            record: payload
          });
        } else {
          // 受注明細番号がない場合 -> 新規登録対象
          newRows.push({
            rowIndex: index,
            record: payload
          });
        }
      });

      try {
        const apiPromises = [];

        // 1. 新規登録処理 (POST) の準備
        if (newRows.length > 0) {
          const recordsToPost = newRows.map(function(item) { return item.record; });
          const postPromise = kintone.api(
            kintone.api.url('/k/v1/records.json', true),
            'POST',
            { app: DETAIL_APP_ID, records: recordsToPost }
          ).then(function(resp) {
            return newRows.map(function(item, idx) {
              return {
                rowIndex: item.rowIndex,
                newDetailId: resp.ids[idx]
              };
            });
          });
          apiPromises.push(postPromise);
        } else {
          apiPromises.push(Promise.resolve([]));
        }

        // 2. 既存更新処理 (PUT) の準備
        if (updateRecords.length > 0) {
          const putPromise = kintone.api(
            kintone.api.url('/k/v1/records.json', true),
            'PUT',
            { app: DETAIL_APP_ID, records: updateRecords }
          );
          apiPromises.push(putPromise);
        } else {
          apiPromises.push(Promise.resolve());
        }

        // ★ Promise.all を await してPOSTとPUTの並列処理完了を同期待機
        const results = await Promise.all(apiPromises);
        const newIdMappings = results[0]; // 新規作成時のIDマッピング

        // サブテーブルのコピーを作成
        const updatedTable = subtable.map(function(row) {
          return {
            id: row.id,
            value: Object.assign({}, row.value)
          };
        });

        // 新規登録された行にだけ採番された「受注明細番号」をセット
        newIdMappings.forEach(function(item) {
          updatedTable[item.rowIndex].value['受注明細番号'] = {
            value: String(item.newDetailId)
          };
        });

        // ★ 親アプリ（受注管理）のレコードをPUT更新
        await kintone.api(
          kintone.api.url('/k/v1/record.json', true),
          'PUT',
          {
            app: kintone.app.getId(),
            id: kintone.app.record.getId(),
            record: { 'Table': { value: updatedTable } }
          }
        );

        alert('テーブル展開（新規登録＆更新）が正常に完了しました。');
        location.reload();
      } catch (err) {
        console.error('処理エラー:', err);
        alert('エラーが発生しました: ' + (err.message || JSON.stringify(err)));
      }
    });

    headerMenuEl.appendChild(btn);
    return event;
  });
})();
