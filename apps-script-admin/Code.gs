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


/**
 * Save elevator schedule pasted from a WhatsApp notice.
 * Date is any day belonging to the desired Sunday–Saturday week.
 * Only runs in the private owner-only Apps Script deployment.
 */
function saveElevatorNotice(dateText, notice) {
  if (typeof dateText !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(dateText)) throw Error('יש לבחור תאריך תקין');
  const parts = dateText.split('-').map(Number);
  const d = new Date(parts[0], parts[1]-1, parts[2], 12);
  if (d.getFullYear()!==parts[0] || d.getMonth()!==parts[1]-1 || d.getDate()!==parts[2]) throw Error('תאריך לא תקין');
  d.setDate(d.getDate()-d.getDay());
  const key = Utilities.formatDate(d, 'Asia/Jerusalem', 'yyyy-MM-dd');
  if (typeof notice!=='string' || notice.length>15000) throw Error('טקסט לא תקין');
  const matches = [...notice.matchAll(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/g)];
  if (matches.length<3 || matches.length>40) throw Error('נדרשים לפחות 3 טווחים: שניים לערב שבת והיתר לשבת');
  const ranges = matches.map(m=>{
    const h=Number(m[1]), n=Number(m[2]), h2=Number(m[3]), n2=Number(m[4]);
    if(h>23 || h2>23 || n>59 || n2>59 || h*60+n>=h2*60+n2) throw Error('טווח שעות לא תקין');
    const pad=v=>String(v).padStart(2,'0');
    return {start:pad(h)+':'+pad(n), end:pad(h2)+':'+pad(n2)};
  });
  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const file=DriveApp.getFileById(DATA_FILE_ID);
    let data={format:'halachic-weekly-v1',weeks:{}};
    try {const parsed=JSON.parse(file.getBlob().getDataAsString('UTF-8'));if(parsed?.format==='halachic-weekly-v1' && parsed.weeks && typeof parsed.weeks==='object')data=parsed;}catch(e){}
    const previous=data.weeks[key] || {};
    data.weeks[key]={...previous,elevatorFriday:ranges.slice(0,2),elevatorSaturday:ranges.slice(2)};
    data.updatedAt=new Date().toISOString();
    file.setContent(JSON.stringify(data));
    return 'נשמרו '+ranges.length+' טווחי מעלית לשבוע שמתחיל ב-'+key+' (2 לערב שבת, '+(ranges.length-2)+' לשבת)';
  }finally{lock.releaseLock();}
}
