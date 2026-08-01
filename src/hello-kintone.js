kintone.events.on('app.record.create.show', (event) => {
  event.record.note.value = 'こんにちは、kintone!';
  return event;
});