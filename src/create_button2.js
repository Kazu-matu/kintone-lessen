(() => {
    'use strict';

    kintone.events.on('app.record.detail.show', (event) => {
        const menuButton = document.createElement('button');
        menuButton.id = 'menu_button';
        menuButton.innerText = 'ボタン';
        // JavaScript の クリックイベントを発生させる
        menuButton.onclick = function () {
            const spaceField = kintone.app.record.getSpaceElement('space_field');

            let updatedAt = '';
            // レコードの値を取得する
            const rec = kintone.app.record.get();
            // 取得したレコードの値の中から更新日時の値を取り出す
            if (rec) {
                updatedAt = rec.record.更新日時.value;
            }
            // スペースフィールドに取得した更新日時の値を入れる
            spaceField.innerText = updatedAt;
        };

        kintone.app.record.getHeaderMenuSpaceElement().appendChild(menuButton);
        return event;
    });
})();
