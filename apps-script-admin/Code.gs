// Private admin web app. Deploy: Execute as me; Who has access: Only myself.
const DATA_FILE_ID = '1rL-LOkjaV0FWOTDm2fGopW04G2ROfuMM';
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Admin').setTitle('ניהול לוח שארית ישראל');
}
function writeSchedules(jsonText) {
  if (typeof jsonText !== 'string' || jsonText.length > 250000) throw Error('קלט גדול מדי');
  const parsed = JSON.parse(jsonText);
  if (parsed.format !== 'halachic-weekly-v1' || !parsed.weeks || typeof parsed.weeks !== 'object' || Array.isArray(parsed.weeks)) throw Error('פורמט לא תקין');
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  const fields = ['weekdayMincha','weekdayArvit','fridayMinchaGedola','fridayCandles','fridayMinchaArvit','shabbatMinchaGedola','shabbatMinchaKetana','shabbatArvit'];
  const clean = {};
  for (const [week, data] of Object.entries(parsed.weeks)) {
    if (!/^20\d\d-\d\d-\d\d$/.test(week) || !data || typeof data !== 'object' || Array.isArray(data)) throw Error('שבוע לא תקין');
    const entry = {};
    for (const field of fields) {
      const value = data[field] || '';
      if (typeof value !== 'string' || (value && !clock.test(value) && !(field === 'fridayMinchaArvit' && /^\+\d{1,3}$/.test(value)))) throw Error('שעה לא תקינה: ' + field);
      entry[field] = value;
    }
    for (const type of ['elevatorFriday','elevatorSaturday']) {
      const ranges = data[type] || [];
      if (!Array.isArray(ranges) || ranges.length > 40) throw Error('רשימת מעלית לא תקינה');
      entry[type] = ranges.map(r => {
        if (!r || !clock.test(r.start) || !clock.test(r.end) || r.end <= r.start) throw Error('טווח מעלית לא תקין');
        return {start:r.start,end:r.end};
      });
    }
    clean[week] = entry;
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const file = DriveApp.getFileById(DATA_FILE_ID);
    let old = {format:'halachic-weekly-v1',weeks:{}};
    try { old = JSON.parse(file.getBlob().getDataAsString('UTF-8')); } catch (e) {}
    const merged = {format:'halachic-weekly-v1',updatedAt:new Date().toISOString(),weeks:{...(old.weeks || {}),...clean}};
    file.setContent(JSON.stringify(merged));
    return 'נשמרו ' + Object.keys(clean).length + ' שבועות';
  } finally { lock.releaseLock(); }
}
