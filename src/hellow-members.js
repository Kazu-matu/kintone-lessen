(() => {
  'use strict';

  kintone.events.on('app.record.index.show', (event) => {
    // ログインユーザーのコードを取得
    const loginUser = kintone.getLoginUser();
    const loguinUserCode = loginUser.code;

    // 表示するユーザーを設定
    const targetUserCodes = ['松島和文', 'kazufumi0707@gmail.com'];

    // レコード一覧のメニューの下側の要素を取得
    const headerSpaceElement = kintone.app.getHeaderSpaceElement();
    console.log('ログインユーザーコード:', loguinUserCode);

    if (targetUserCodes.includes(loguinUserCode)) {
      // ログインユーザーに応じた処理をここに書く
      headerSpaceElement.textContent = 'Hello Members!';
    } else {
      headerSpaceElement.textContent = 'メンバーではありません！';
    }

    return event;
  });
})();