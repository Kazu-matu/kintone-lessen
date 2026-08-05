const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// 環境変数の読み込み
const KINTONE_BASE_URL = process.env.KINTONE_BASE_URL;
const KINTONE_USER = process.env.KINTONE_USER;
const KINTONE_PASSWORD = process.env.KINTONE_PASSWORD;
const APP_ID_PARENT = process.env.APP_ID_PARENT;
const APP_ID_CHILD = process.env.APP_ID_CHILD;

// 認証ヘッダーの生成 (Base64)
const auth = Buffer.from(`${KINTONE_USER}:${KINTONE_PASSWORD}`).toString('base64');
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
  await page.screenshot({ path: screenshotPath, fullPage: true });
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
  // ポータルの表示待機
  await page.waitForURL(new RegExp(`${KINTONE_BASE_URL}/k/#/portal`));
}

/**
 * API経由でテスト用「受注管理」レコードを作成する
 */
async function createTestParentRecord(request, recordNo, tableRows) {
  const response = await request.post(`${KINTONE_BASE_URL}/k/v1/record.json`, {
    headers,
    data: {
      app: APP_ID_PARENT,
      record: {
        '受注管理No': { value: recordNo },
        '受注日': { value: '2026-08-05' },
        '顧客コード': { value: 'CS-003' },
        '受注明細Table': {
          value: tableRows.map(row => ({
            value: {
              '商品コード': { value: row.itemCode },
              'カテゴリ': { value: row.category || '' },
              '商品名': { value: row.itemName || '' },
              '販売単価': { value: row.price ? String(row.price) : '0' },
              '数量': { value: String(row.quantity) },
              '小計': { value: String(row.subtotal) },
              '受注明細番号': { value: row.detailId ? String(row.detailId) : '' }
            }
          }))
        }
      }
    }
  });

  expect(response.ok()).toBe(true);
  const result = await response.json();
  return result.id;
}

/**
 * API経由でレコードの詳細データを取得する
 */
async function getRecordDetails(request, appId, recordId) {
  const response = await request.get(`${KINTONE_BASE_URL}/k/v1/record.json`, {
    headers,
    params: {
      app: appId,
      id: recordId
    }
  });
  expect(response.ok()).toBe(true);
  const result = await response.json();
  return result.record;
}

/**
 * API経由で特定の受注管理Noに紐づく受注明細レコードを全削除する（テスト前クリーンアップ）
 */
async function cleanupChildRecords(request, recordNo) {
  const response = await request.get(`${KINTONE_BASE_URL}/k/v1/records.json`, {
    headers,
    params: {
      app: APP_ID_CHILD,
      query: `受注番号 = "${recordNo}"`
    }
  });
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

    // 1. テストデータの作成 & クリーンアップ準備
    await cleanupChildRecords(request, recordNo);
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
        // アラート表示状態でのエビデンス取得
        await takeScreenshot(page, caseName, '02_alert.png');
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
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_CHILD}/?query=受注番号="${recordNo}"`);
      await page.waitForTimeout(2000); // 描画待機
      await takeScreenshot(page, caseName, '04_detail_records.png');

    } finally {
      // 後片付け
      await cleanupChildRecords(request, recordNo);
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

    await cleanupChildRecords(request, recordNo);
    const parentRecordId = await createTestParentRecord(request, recordNo, testItems);

    try {
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_PARENT}/show#record=${parentRecordId}`);
      await page.waitForSelector('#btn_table_expand_2');
      
      await takeScreenshot(page, caseName, '01_before_click.png');

      let alertMessage = '';
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        await takeScreenshot(page, caseName, '02_alert.png');
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
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_CHILD}/?query=受注番号="${recordNo}"`);
      await page.waitForTimeout(2000);
      await takeScreenshot(page, caseName, '04_detail_records.png');

    } finally {
      await cleanupChildRecords(request, recordNo);
      await cleanupParentRecord(request, parentRecordId);
    }
  });

  test('課題3 (CN-059-9-3): 新規・既存の自動判別と更新（POST/PUT並行処理）の検証', async ({ page, request }) => {
    const caseName = 'CN-059-9-3';
    const recordNo = `E2E-CASE3-${Date.now()}`;
    
    // 既存明細の仮レコード登録用
    const dummyRecordNo = `DUMMY-${Date.now()}`;

    // 先に子レコード（既存登録用）を2件直接APIで作成してIDを取得
    const response1 = await request.post(`${KINTONE_BASE_URL}/k/v1/record.json`, {
      headers,
      data: {
        app: APP_ID_CHILD,
        record: {
          '受注番号': { value: recordNo },
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
          '受注番号': { value: recordNo },
          '商品コード_0': { value: 'CCC01' },
          'カテゴリ': { value: '飲み物' },
          '商品名': { value: 'コーラ' },
          '単価': { value: '90' },
          '数量': { value: '5' },
          '小計': { value: '450' }
        }
      }
    });
    
    const existingId1 = (await response1.json()).id;
    const existingId2 = (await response2.json()).id;

    // 親レコード作成 (1・2行目は既存明細番号あり、3行目は新規で番号なし)
    const testItems = [
      { itemCode: 'BBB01', category: 'お菓子', itemName: 'チョコレート', price: 120, quantity: 20, subtotal: 2400, detailId: existingId1 }, // 数量を10->20に変更
      { itemCode: 'CCC01', category: '飲み物', itemName: 'コーラ', price: 90, quantity: 15, subtotal: 1350, detailId: existingId2 }, // 数量を5->15に変更
      { itemCode: 'AAA01', category: 'お菓子', itemName: 'スナック', price: 150, quantity: 2, subtotal: 300, detailId: '' } // 新規追加行
    ];

    const parentRecordId = await createTestParentRecord(request, recordNo, testItems);

    try {
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_PARENT}/show#record=${parentRecordId}`);
      await page.waitForSelector('#btn_table_expand_3');
      
      await takeScreenshot(page, caseName, '01_before_click.png');

      let alertMessage = '';
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        await takeScreenshot(page, caseName, '02_alert.png');
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
      await page.goto(`${KINTONE_BASE_URL}/k/${APP_ID_CHILD}/?query=受注番号="${recordNo}"`);
      await page.waitForTimeout(2000);
      await takeScreenshot(page, caseName, '04_detail_records.png');

    } finally {
      await cleanupChildRecords(request, recordNo);
      await cleanupParentRecord(request, parentRecordId);
    }
  });

});
