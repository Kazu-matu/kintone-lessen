(() => {
  'use strict';
  kintone.events.on('app.record.create.show', (event) => {
    const record = event.record;
    record['Hello'].value = 'こんにちは、kintone!';
    return event;
  });
})();