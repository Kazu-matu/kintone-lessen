(() => {
    'use strict';
    kintone.events.on('app.record.detail.show', (event) => {
        const menuButton = document.createElement('button');
        menuButton.id = 'menu_button';
        menuButton.innerText = 'ボタン';
        menuButton.addEventListener('click', () => {
            // ボタンをクリックした処理を記述する
            alert('ボタンが押されました');
        });
        // const headerMenuSpace = kintone.app.record.getHeaderMenuSpaceElement();
        // headerMenuSpace.appendChild(menuButton);
        const spaceField = kintone.app.record.getSpaceElement('space_field');
        spaceField.appendChild(menuButton);
        return event;
    });
})();