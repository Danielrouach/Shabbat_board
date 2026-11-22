/* Sunrise/sunset driven appearance for the Rouach Shabbat Board.
   The times are Haifa's Hebcal sunrise and sunset, NOT fixed clock hours.
   The two screens use the same cached times and appearance preference. */
(function(){
'use strict';
const THEME_KEY='rouach_shabbat_theme_v1';
const SOLAR_KEY='rouach_shabbat_solar_v1';
const MANUAL_KEY='rouach_shabbat_theme_manual_v1';
const AUTO_KEY='rouach_shabbat_theme_auto_v1';
const GEO='294801'; // Haifa; same location as main Shabbat board
const ZONE='Asia/Jerusalem';
let solar={};
try{solar=JSON.parse(localStorage.getItem(SOLAR_KEY)||'{}')||{}}catch(_){}
let lastRequestDate='';
const inFlight=new Set();
let lastMinute='';
let overrideInstant=null;
let lastApplied='';
let lastPeriod='';
function autoEnabled(){return safeGet(AUTO_KEY)!=='false'}
function localDay(date){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const p={};for(const x of parts)p[x.type]=x.value;
 return p.year+'-'+p.month+'-'+p.day;
}
function dayOffset(iso,n){
 const [y,m,d]=iso.split('-').map(Number);
 return new Date(Date.UTC(y,m-1,d+n,12)).toISOString().slice(0,10);
}
function safeGet(k){try{return localStorage.getItem(k)}catch(_){return null}}
function safeSet(k,v){try{localStorage.setItem(k,v)}catch(_){}}
function safeRemove(k){try{localStorage.removeItem(k)}catch(_){}}
function currentInstant(){return overrideInstant instanceof Date && Number.isFinite(+overrideInstant)?overrideInstant:new Date()}
function phase(now){
 const day=localDay(now),data=solar[day];
 const sunrise=Date.parse(data?.sunrise||'');
 const sunset=Date.parse(data?.sunset||'');
 if(!Number.isFinite(sunrise)||!Number.isFinite(sunset)||sunrise>=sunset)return null;
 const t=now.getTime();
 if(t<sunrise)return {mode:'dark',period:day+':before-sunrise'};
 if(t<sunset)return {mode:'light',period:day+':daylight'};
 return {mode:'dark',period:day+':after-sunset'};
}
function manual(){
 try{
  const entry=JSON.parse(safeGet(MANUAL_KEY)||'null');
  return entry&&['light','dark'].includes(entry.mode)?entry:null;
 }catch(_){return null}
}
function preferred(now){
 if(!autoEnabled())return {mode:safeGet(THEME_KEY)==='light'?'light':'dark',period:null};
 const choice=manual();
 if(choice)return {mode:choice.mode,period:'manual-until-refresh'};
 const p=phase(now);
 if(p)return p;
 // When offline with no exact solar data, preserve the last chosen appearance.
 const fromLink=new URLSearchParams(location.search).get('theme');
 return {mode:fromLink==='light'||fromLink==='dark'?fromLink:(safeGet(THEME_KEY)==='light'?'light':'dark'),period:null};
}
function apply(mode){
 const light=mode==='light';
 const html=document.documentElement;
 html.classList.toggle('light-theme',light);
 html.style.colorScheme=light?'light':'dark';
 const toggles=document.querySelectorAll('[data-theme-auto]');
 for(const input of toggles){
  input.checked=autoEnabled();
  input.title=input.checked?'מעבר אוטומטי בהנץ ובשקיעה; בחירה ידנית עד רענון':'מצב ידני קבוע, ללא שינוי אוטומטי';
 }
 const buttons=document.querySelectorAll('[data-theme-toggle]');
 for(const button of buttons){
  button.textContent=light?'☾ מצב כהה':'☀ מצב בהיר';
  button.setAttribute('aria-pressed',String(light));
  button.title=light?'מעבר למצב כהה (עד מעבר השמש הבא)':'מעבר למצב בהיר (עד מעבר השמש הבא)';
 }
 for(const link of document.querySelectorAll('a[href^="elevator.html"]')){
  link.href='elevator.html?theme='+mode;
 }
 if(lastApplied!==mode){
  lastApplied=mode;
  if(typeof window.requestColumnFit==='function')window.requestColumnFit();
 }
}
function sync(now,force){
 const instant=now instanceof Date?now:currentInstant();
 const minute=Math.floor(instant.getTime()/60000);
 if(!force&&minute===lastMinute)return;
 lastMinute=minute;
 const v=preferred(instant);
 lastPeriod=v.period;
 apply(v.mode);
 // Shared storage signals the second screen when it is open.
 if(safeGet(THEME_KEY)!==v.mode)safeSet(THEME_KEY,v.mode);
 const today=localDay(instant);
 if(lastRequestDate!==today){lastRequestDate=today;preload(today)}
}
function setTimes(day,times){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!times)return;
 const sunrise=times.sunrise,sunset=times.sunset;
 const a=Date.parse(sunrise||''),b=Date.parse(sunset||'');
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return;
 solar[day]={sunrise:new Date(a).toISOString(),sunset:new Date(b).toISOString()};
 // Keep a modest offline cache; allows Saturday to work without internet.
 const keys=Object.keys(solar).sort();
 for(const key of keys.slice(0,Math.max(0,keys.length-20)))delete solar[key];
 safeSet(SOLAR_KEY,JSON.stringify(solar));
 sync(undefined,true);
}
async function preload(date){
 // Today + two next days, so the upcoming Saturday works offline.
 for(let i=0;i<3;i++){
  const day=dayOffset(date,i);
  if(solar[day]||inFlight.has(day))continue;
  inFlight.add(day);
  fetch('https://www.hebcal.com/zmanim?cfg=json&geonameid='+GEO+'&date='+day+'&sec=1')
   .then(r=>{if(!r.ok)throw Error('Zmanim '+r.status);return r.json()})
   .then(data=>setTimes(day,data.times||{}))
   .catch(()=>{}) // Retain cached appearance when offline.
   .finally(()=>inFlight.delete(day));
 }
}
function toggle(){
 const mode=document.documentElement.classList.contains('light-theme')?'dark':'light';
 // Automatic enabled: override shared between both screens, but ONLY until F5.
 // Automatic disabled: persist chosen mode indefinitely.
 if(autoEnabled())safeSet(MANUAL_KEY,JSON.stringify({mode}));
 else safeRemove(MANUAL_KEY);
 safeSet(THEME_KEY,mode);
 const url=new URL(location.href);
 if(url.searchParams.has('theme')){
  url.searchParams.delete('theme');
  history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 sync(undefined,true);
}
function setAuto(enabled){
 const fixedMode=document.documentElement.classList.contains('light-theme')?'light':'dark';
 safeSet(AUTO_KEY,enabled?'true':'false');
 safeRemove(MANUAL_KEY);
 if(!enabled)safeSet(THEME_KEY,fixedMode);
 sync(undefined,true);
}
function setNow(date){overrideInstant=date instanceof Date?date:null;sync(undefined,true)}
// Theme handoff is used only on first paint if solar times aren't available yet.
// Reload/F5 always cancels temporary manual override; other open tabs are notified.
try{
 const navigation=performance.getEntriesByType('navigation')[0];
 if(navigation?.type==='reload'&&autoEnabled())safeRemove(MANUAL_KEY);
}catch(_){}
const handed=new URLSearchParams(location.search).get('theme');
if((handed==='light'||handed==='dark')&&!phase(new Date()))safeSet(THEME_KEY,handed);
apply(preferred(new Date()).mode);
document.addEventListener('DOMContentLoaded',()=>{
 sync(undefined,true);
 document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',toggle));
 document.querySelectorAll('[data-theme-auto]').forEach(box=>box.addEventListener('change',()=>setAuto(box.checked)));
});
window.addEventListener('storage',e=>{
 if(e.key===SOLAR_KEY){try{solar=JSON.parse(e.newValue||'{}')||{}}catch(_){}}
 if([THEME_KEY,SOLAR_KEY,MANUAL_KEY,AUTO_KEY].includes(e.key)){
  sync(undefined,true);
 }
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync(undefined,true)});
setInterval(()=>sync(),15000);
window.ShabbatTheme={toggle,setAuto,autoEnabled,apply,get:()=>document.documentElement.classList.contains('light-theme')?'light':'dark',sync,setTimes,setNow};
})();