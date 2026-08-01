(() => {
    'use strict';
    // 制御に利用するラジオボタンのフィールドコード
    const inquiryTypeFieldCode = 'QType';
    // テンプレートメッセージを設定する文字列（複数行）フィールドのフィールドコード
    const messageFieldCode = 'Detail';

    kintone.events.on([
        'app.record.create.show',
        `app.record.edit.change.${inquiryTypeFieldCode}`,
        `app.record.create.change.${inquiryTypeFieldCode}`
    ], (event) => {
        const record = event.record;
        const inquiryType = record[inquiryTypeFieldCode].value;

        switch (inquiryType) {
            case '製品について':
                record[messageFieldCode].value = '製品名と詳細をご記入ください。';
                break;
            case '受発注について':
                record[messageFieldCode].value = '発注番号と詳細をご記入ください。';
                break;
            case 'お客様対応について':
                record[messageFieldCode].value = 'お客様名と詳細をご記入ください。';
                break;
            case 'その他':
                record[messageFieldCode].value = '詳細をご記入ください。';
                break;
            default:
                record[messageFieldCode].value = ''; // 該当しない場合はクリア
        }

        return event;
    });
})();