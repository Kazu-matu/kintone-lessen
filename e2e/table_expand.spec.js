require('dotenv').config();
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 環境変数の読み込み
const KINTONE_BASE_URL = process.env.KINTONE_BASE_URL;
const KINTONE_USER = process.env.KINTONE_USER;
const KINTONE_PASSWORD = process.env.KINTONE_PASSWORD;
const APP_ID_PARENT = process.env.APP_ID_PARENT;
const APP_ID_CHILD = process.env.APP_ID_CHILD;

console.log('ENV VALS:', { KINTONE_BASE_URL, APP_ID_PARENT, APP_ID_CHILD });

// 認証ヘッダーの生成 (Base64)
const auth = Buffer.from(`${KINTONE_USER || ''}:${KINTONE_PASSWORD || ''}`).toString('base64');
const headers = {
  'X-Cybozu-Authorization': auth,
  'Content-Type': 'application/json'
};

/**
 * テスト完了後にエビデンス用のディレクトリを保証する
 */
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

/**
 * スクリーンショット撮影のヘルパー関数
 */
async function takeScreenshot(page, caseName, imageName) {
  const screenshotPath = path.join(__dirname, 'evidence', caseName, imageName);
  ensureDirectoryExistence(screenshotPath);
  await page.screenshot({ path: screenshotPath });
}

/**
 * kintoneのログイン処理を行う
 */
async function loginKintone(page) {
  await page.goto(`${KINTONE_BASE_URL}/login`);
  // ログイン画面の入力
  await page.fill('input[name="username"]', KINTONE_USER);
  await page.fill('input[name="password"]', KINTONE_PASSWORD);
  await page.click('input[type="submit"]');
  // ログイン成功後のリダイレクト（トップ画面またはkintone画面）を待つ
  await page.waitForURL(url => url.href === `${KINTONE_BASE_URL}/` || url.href.includes(`${KINTONE_BASE_URL}/k/`));
  // 明示的にkintoneポータルへ移動
  await page.goto(`${KINTONE_BASE_URL}/k/`);
  await page.waitForURL(new RegExp(`${KINTONE_BASE_URL}/k/#/portal`));
}

/**
 * API経由でテスト用「受注管理」レコードを作成する
 */
async function createTestParentRecord(request, recordNo, tableRows) {
  const recordData = {
    '受注日': { value: '2026-08-05' },
    '顧客コード': { value: 'CS-003' },
    '発注者': { value: recordNo }, // テスト識別用に発注者に recordNo を設定
    '受注明細Table': {
      value: tableRows.map(row => {
        const item = {
          '商品コード': { value: row.itemCode },
          'カテゴリ': { value: row.category || '' },
          '商品名': { value: row.itemName || '' },
          '販売単価': { value: row.price ? String(row.price) : '0' },
          '数量': { value: String(row.quantity) },
          '小計': { value: String(row.subtotal) }
        };
        if (row.detailId) {
          item['受注明細番号'] = { value: String(row.detailId) };
        }
        return { value: item };
      })
    }
  };

  const response = await request.post(`${KINTONE_BASE_URL}/k/v1/record.json`, {
    headers,
    data: {
      app: APP_ID_PARENT,
      record: recordData
    }
  });

  if (!response.ok()) {
    console.error('createTestParentRecord failed:', response.status(), await response.text());
  }
  expect(response.ok()).toBe(true);
  const result = await response.json();
  return result.id;
}

/**
 * API経由でレコードの詳細データを取得する
 */
async function getRecordDetails(request, appId, recordId) {
  const url = `${KINTONE_BASE_URL}/k/v1/record.json?app=${appId}&id=${recordId}`;
  console.log('getRecordDetails request:', url);
  const response = await request.get(url, {
    headers: { 'X-Cybozu-Authorization': auth }
  });
  if (!response.ok()) {
    console.error('getRecordDetails failed:', response.status(), await response.text());
  }
  expect(response.ok()).toBe(true);
  const result = await response.json();
  return result.record;
}

/**
 * API経由で特定の受注番号（親レコードID数値）に紐づく受注明細レコードを全削除する（テスト後クリーンアップ）
 */
async function cleanupChildRecords(request, parentRecordId) {
  if (!parentRecordId) return;
  const queryStr = `受注番号 = ${parentRecordId}`;
  const url = `${KINTONE_BASE_URL}/k/v1/records.json?app=${APP_ID_CHILD}&query=${encodeURIComponent(queryStr)}`;
  console.log('cleanupChildRecords request:', url);
  const response = await request.get(url, {
    headers: { 'X-Cybozu-Authorization': auth }
  });
  if (!response.ok()) {
    console.error('cleanupChildRecords GET failed:', response.status(), await response.text());
  }
  expect(response.ok()).toBe(true);
  const result = await response.json();
  
  if (result.records.length > 0) {
    const ids = result.records.map(r => r.$id.value);
    const delResponse = await request.delete(`${KINTONE_BASE_URL}/k/v1/records.json`, {
      headers,
      data: {
        app: APP_ID_CHILD,
        ids: ids
      }
    });
    if (!delResponse.ok()) {
      console.error('cleanupChildRecords DELETE failed:', delResponse.status(), await delResponse.text());
    }
    expect(delResponse.ok()).toBe(true);
  }
}

/**
 * API経由でテストレコード（親）を削除する
 */
async function cleanupParentRecord(request, recordId) {
  const delResponse = await request.delete(`${KINTONE_BASE_URL}/k/v1/records.json`, {
    headers,
    data: {
      app: APP_ID_PARENT,
      ids: [recordId]
    }
  });
  expect(delResponse.ok()).toBe(true);
}

// ==========================================
// テストシナリオの実行
// ==========================================

test.describe('kintone テーブル展開機能の検証', () => {

  test.beforeEach(async ({ page }) => {
    // 全テストケースの実行前にログイン
    await loginKintone(page);
  });

  test('課題1 (CN-057-9-1): 新規一括登録（POSTのみ）の検証', async ({ page, request }) => {
    const caseName = 'CN-057-9-1';
    const recordNo = `E2E-CASE1-${Date.now()}`;
    const testItems = [
      { itemCode: 'BBB01', category: 'お菓子', itemName: 'チョコレート', price: 120, quantity: 10, subtotal: 1200 },
      { itemCode: 'CCC01', category: '飲み物', itemName: 'コーラ', price: 90, quantity: 5, subtotal: 450 }
    ];

    // 1. テストデータの作成
    const parentRecordId = await createTestParentRecord(request, recordNo, testItems);

    try {
      // 2. 詳細画面へ遷移
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_PARENT}/show#record=${parentRecordId}`);
      await page.waitForSelector('#btn_table_expand_1'); // ボタンの出現を待つ
      
      // ボタン押下前エビデンスの取得
      await takeScreenshot(page, caseName, '01_before_click.png');

      // 3. アラートのハンドリング設定とボタンクリック
      let alertMessage = '';
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#btn_table_expand_1');
      
      // ダイアログの処理完了を少し待つ
      await page.waitForTimeout(2000);

      // アラートメッセージの検証
      expect(alertMessage).toContain('受注明細アプリへ 2 件の明細展開登録が完了しました！');

      // ボタン押下後エビデンスの取得
      await takeScreenshot(page, caseName, '03_after_click.png');

      // 4. データ整合性検証 (親レコードの受注明細番号が空のままであること)
      const updatedParent = await getRecordDetails(request, APP_ID_PARENT, parentRecordId);
      const parentTable = updatedParent.受注明細Table.value;
      expect(parentTable[0].value.受注明細番号.value).toBe('');
      expect(parentTable[1].value.受注明細番号.value).toBe('');

      // 5. 子アプリ（受注明細）に遷移してエビデンスを取得
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_CHILD}/?query=受注番号="${parentRecordId}"`); // 子アプリでのクエリは親ID値を使用
      await page.waitForTimeout(2000); // 描画待機
      await takeScreenshot(page, caseName, '04_detail_records.png');

    } finally {
      // 後片付け
      await cleanupChildRecords(request, parentRecordId);
      await cleanupParentRecord(request, parentRecordId);
    }
  });

  test('課題2 (CN-058-9-2): 一括登録と採番ID書き戻し（POST & PUT）の検証', async ({ page, request }) => {
    const caseName = 'CN-058-9-2';
    const recordNo = `E2E-CASE2-${Date.now()}`;
    const testItems = [
      { itemCode: 'BBB01', category: 'お菓子', itemName: 'チョコレート', price: 120, quantity: 10, subtotal: 1200 },
      { itemCode: 'CCC01', category: '飲み物', itemName: 'コーラ', price: 90, quantity: 5, subtotal: 450 }
    ];

    const parentRecordId = await createTestParentRecord(request, recordNo, testItems);

    try {
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_PARENT}/show#record=${parentRecordId}`);
      await page.waitForSelector('#btn_table_expand_2');
      
      await takeScreenshot(page, caseName, '01_before_click.png');

      let alertMessage = '';
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#btn_table_expand_2');
      
      // リロード（完了後のlocation.reload）を待機
      await page.waitForNavigation({ waitUntil: 'load' });
      await page.waitForSelector('#btn_table_expand_2');

      expect(alertMessage).toContain('受注明細の登録および受注明細番号の書き戻しが完了しました。');

      // リロード後のエビデンス取得（明細番号が入っている状態）
      await takeScreenshot(page, caseName, '03_after_click.png');

      // データ検証：親のテーブルに受注明細番号がセットされているか
      const updatedParent = await getRecordDetails(request, APP_ID_PARENT, parentRecordId);
      const parentTable = updatedParent.受注明細Table.value;
      const id1 = parentTable[0].value.受注明細番号.value;
      const id2 = parentTable[1].value.受注明細番号.value;

      expect(id1).not.toBe('');
      expect(id2).not.toBe('');

      // 子レコードが実際に存在するかAPIで検証
      const child1 = await getRecordDetails(request, APP_ID_CHILD, id1);
      const child2 = await getRecordDetails(request, APP_ID_CHILD, id2);
      expect(child1.商品コード_0.value).toBe('BBB01');
      expect(child2.商品コード_0.value).toBe('CCC01');

      // 子アプリ（受注明細）に遷移してエビデンスを取得
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_CHILD}/?query=受注番号=${parentRecordId}`);
      await page.waitForTimeout(2000);
      await takeScreenshot(page, caseName, '04_detail_records.png');

    } finally {
      await cleanupChildRecords(request, parentRecordId);
      await cleanupParentRecord(request, parentRecordId);
    }
  });

  test('課題3 (CN-059-9-3): 新規・既存の自動判別と更新（POST/PUT並行処理）の検証', async ({ page, request }) => {
    const caseName = 'CN-059-9-3';
    const recordNo = `E2E-CASE3-${Date.now()}`;
    
    // 1. まず親レコードを一度作成する（数量などは初期値）
    const initialItems = [
      { itemCode: 'BBB01', category: 'お菓子', itemName: 'チョコレート', price: 120, quantity: 10, subtotal: 1200 },
      { itemCode: 'CCC01', category: '飲み物', itemName: 'コーラ', price: 90, quantity: 5, subtotal: 450 },
      { itemCode: 'AAA01', category: 'お菓子', itemName: 'スナック', price: 150, quantity: 2, subtotal: 300 }
    ];
    const parentRecordId = await createTestParentRecord(request, recordNo, initialItems);

    try {
      // 2. 作成した親IDを使って、子レコード（既存明細）を2件APIで直接作成
      const response1 = await request.post(`${KINTONE_BASE_URL}/k/v1/record.json`, {
        headers,
        data: {
          app: APP_ID_CHILD,
          record: {
            '受注番号': { value: String(parentRecordId) }, // 親ID数値を文字列で渡す
            '商品コード_0': { value: 'BBB01' },
            'カテゴリ': { value: 'お菓子' },
            '商品名': { value: 'チョコレート' },
            '単価': { value: '120' },
            '数量': { value: '10' },
            '小計': { value: '1200' }
          }
        }
      });
      const response2 = await request.post(`${KINTONE_BASE_URL}/k/v1/record.json`, {
        headers,
        data: {
          app: APP_ID_CHILD,
          record: {
            '受注番号': { value: String(parentRecordId) },
            '商品コード_0': { value: 'CCC01' },
            'カテゴリ': { value: '飲み物' },
            '商品名': { value: 'コーラ' },
            '単価': { value: '90' },
            '数量': { value: '5' },
            '小計': { value: '450' }
          }
        }
      });
      expect(response1.ok()).toBe(true);
      expect(response2.ok()).toBe(true);
      const existingId1 = (await response1.json()).id;
      const existingId2 = (await response2.json()).id;

      // 3. 親レコードのサブテーブルを更新し、1・2行目に明細IDを埋め込み、数量などの変更を加える
      const updateResponse = await request.put(`${KINTONE_BASE_URL}/k/v1/record.json`, {
        headers,
        data: {
          app: APP_ID_PARENT,
          id: parentRecordId,
          record: {
            '受注明細Table': {
              value: [
                {
                  value: {
                    '商品コード': { value: 'BBB01' },
                    'カテゴリ': { value: 'お菓子' },
                    '商品名': { value: 'チョコレート' },
                    '販売単価': { value: '120' },
                    '数量': { value: '20' }, // 10 -> 20 へ変更
                    '小計': { value: '2400' },
                    '受注明細番号': { value: String(existingId1) } // 既存IDを設定
                  }
                },
                {
                  value: {
                    '商品コード': { value: 'CCC01' },
                    'カテゴリ': { value: '飲み物' },
                    '商品名': { value: 'コーラ' },
                    '販売単価': { value: '90' },
                    '数量': { value: '15' }, // 5 -> 15 へ変更
                    '小計': { value: '1350' },
                    '受注明細番号': { value: String(existingId2) } // 既存IDを設定
                  }
                },
                {
                  value: {
                    '商品コード': { value: 'AAA01' },
                    'カテゴリ': { value: 'お菓子' },
                    '商品名': { value: 'スナック' },
                    '販売単価': { value: '150' },
                    '数量': { value: '2' },
                    '小計': { value: '300' },
                    '受注明細番号': { value: '' } // 新規なので空
                  }
                }
              ]
            }
          }
        }
      });
      expect(updateResponse.ok()).toBe(true);
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_PARENT}/show#record=${parentRecordId}`);
      await page.waitForSelector('#btn_table_expand_3');
      
      await takeScreenshot(page, caseName, '01_before_click.png');

      let alertMessage = '';
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await page.click('#btn_table_expand_3');
      
      // リロードを待機
      await page.waitForNavigation({ waitUntil: 'load' });
      await page.waitForSelector('#btn_table_expand_3');

      expect(alertMessage).toContain('テーブル展開（新規登録＆更新）が正常に完了しました。');

      // リロード後のエビデンス取得
      await takeScreenshot(page, caseName, '03_after_click.png');

      // データ検証：新規行にのみ新しいIDが書き戻されていること
      const updatedParent = await getRecordDetails(request, APP_ID_PARENT, parentRecordId);
      const parentTable = updatedParent.受注明細Table.value;
      
      expect(parentTable[0].value.受注明細番号.value).toBe(String(existingId1));
      expect(parentTable[1].value.受注明細番号.value).toBe(String(existingId2));
      
      const newId = parentTable[2].value.受注明細番号.value;
      expect(newId).not.toBe('');
      expect(newId).not.toBe(String(existingId1));
      expect(newId).not.toBe(String(existingId2));

      // 既存明細の数量が更新（PUT）されているかAPIで検証
      const child1 = await getRecordDetails(request, APP_ID_CHILD, existingId1);
      const child2 = await getRecordDetails(request, APP_ID_CHILD, existingId2);
      expect(child1.数量.value).toBe('20'); // 10 -> 20
      expect(child2.数量.value).toBe('15'); // 5 -> 15

      // 子アプリ（受注明細）に遷移してエビデンスを取得
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_CHILD}/?query=受注番号=${parentRecordId}`);
      await page.waitForTimeout(2000);
      await takeScreenshot(page, caseName, '04_detail_records.png');

    } finally {
      await cleanupChildRecords(request, parentRecordId);
      await cleanupParentRecord(request, parentRecordId);
    }
  });

});
