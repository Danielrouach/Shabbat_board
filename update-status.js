/* Separate feature update status. Parasha cycles roll over at actual havdalah. */
(function(global){
'use strict';
const ZONE='Asia/Jerusalem';
const KEYS={prayers:'prayersUpdatedAt',elevator:'elevatorUpdatedAt'};
function timeValue(raw){const n=Date.parse(raw||'');return Number.isFinite(n)?n:null}
function plusWeek(sat){const d=new Date(sat+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,10)}
function cycleSaturday(d){
 const iso=ShabbatElevator.saturdayISO(d);
 const parts=ShabbatElevator.localParts(d);
 if(parts.day===6){
  const exit=ShabbatElevator.havdalah(d);
  if(exit!==null && d.getTime()>=exit)return plusWeek(iso);
 }
 return iso;
}
function saturdayDate(iso){return new Date(iso+'T12:00:00Z')}
function parashaName(iso){
 return ShabbatElevator.parasha(saturdayDate(iso)).replace(/^(?:פרשת\s*)+/,'').trim();
}
const inflight=new Set();
function ensureParasha(iso){
 if(!iso||inflight.has(iso)||parashaName(iso))return;
 inflight.add(iso);
 ShabbatElevator.prime(saturdayDate(iso)).finally(()=>inflight.delete(iso));
}
function formatDate(ms){return new Intl.DateTimeFormat('he-IL',{timeZone:ZONE,day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms))}
function latest(weeks,feature){
 let found=null,hasLegacy=false;
 for(const [key,item] of Object.entries(weeks||{})){
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(key)||!item||typeof item!=='object')continue;
  const hasData=feature==='elevator'?((Array.isArray(item.elevatorFriday)&&item.elevatorFriday.length>0)||(Array.isArray(item.elevatorSaturday)&&item.elevatorSaturday.length>0)):
   ['weekdayMincha','weekdayArvit','fridayMinchaGedola','fridayCandles','fridayMinchaArvit','shabbatMinchaGedola','shabbatMinchaKetana','shabbatArvit'].some(field=>!!item[field]);
  if(!hasData)continue;
  const ms=timeValue(item[KEYS[feature]]);
  if(ms!==null&&(!found||ms>found.ms))found={ms,week:key};
  else if(ms===null)hasLegacy=true;
 }
 return {found,hasLegacy};
}
function status(weeks,feature,now=new Date()){
 const currentSat=cycleSaturday(now);
 ensureParasha(currentSat);
 const currentParasha=parashaName(currentSat);
 const {found,hasLegacy}=latest(weeks,feature);
 if(!found){
  return {warning:true,text:hasLegacy?'⚠ שים לב, אין תאריך עדכון מתועד לנתונים הקיימים':'⚠ שים לב, טרם נשמר עדכון',detail:''};
 }
 // The date of the save, not the selected week, determines the update parasha.
 const savedCycle=cycleSaturday(new Date(found.ms));
 ensureParasha(savedCycle);
 const savedName=parashaName(savedCycle);
 const dateText=formatDate(found.ms);
 const same=savedCycle===currentSat;
 const last=savedName?'עודכן בפרשת '+savedName:'עודכן לאחרונה';
 if(same)return {warning:false,text:last+' (עדכון אחרון: '+dateText+')',detail:dateText};
 const currentText=currentParasha?'פרשת '+currentParasha:'הפרשה הנוכחית';
 return {warning:true,text:'⚠ שים לב, לא עודכן עבור '+currentText+' (עדכון אחרון: '+dateText+(savedName?' · פרשת '+savedName:'')+')',detail:dateText};
}
/* Get the latest saved elevator timetable at or before the selected week.
   A prayers-only record must not hide an older elevator timetable. */
function elevatorSchedule(weeks,selectedWeek){
 const keys=Object.keys(weeks||{}).filter(key=>{
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(key)||key>selectedWeek)return false;
  const item=weeks[key];
  if(!item||typeof item!=='object')return false;
  const validRange=row=>row&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end||'')&&row.end>row.start;
  return [item.elevatorFriday,item.elevatorSaturday].some(ranges=>Array.isArray(ranges)&&ranges.some(validRange));
 }).sort();
 const sourceWeek=keys[keys.length-1]||null;
 return {entry:sourceWeek?weeks[sourceWeek]:null,sourceWeek,old:!!sourceWeek&&sourceWeek!==selectedWeek};
}

global.ShabbatUpdateStatus={status,cycleSaturday,elevatorSchedule};
})(window);
