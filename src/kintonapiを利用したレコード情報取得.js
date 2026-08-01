(async () => {
    // 一覧画面では event.appId などが使えないため、現在のアプリIDを直接取得します
    const body = {
        app: kintone.app.getId(),
        id: 1 // ★取得したいレコード番号（例：1）を指定してください
    };

    try {
        const resp = await kintone.api(
            kintone.api.url('/k/v1/record.json', true),
            'GET',
            body
        );
        console.log('成功:', resp);
    } catch (error) {
        console.log('失敗:', error);
    }
})();