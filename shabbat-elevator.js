/* Shared elevator timing for both public displays. Local dates in Asia/Jerusalem.
   Repeats Friday-night intervals on Saturday evening, until Havdalah + 30 min. */
(function(global){
'use strict';
const STORAGE='shabbat_board_havdalah_v1';
const ZONE='Asia/Jerusalem';
const cache=new Map();
const listeners=new Set();
function z2(n){return String(n).padStart(2,'0')}
function localParts(d){
 const p={};for(const x of new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(d))p[x.type]=x.value;
 return {y:+p.year,m:+p.month,d:+p.day,day:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday],minutes:+p.hour*60+(+p.minute)};
}
function saturdayISO(d){
 const p=localParts(d);const utc=new Date(Date.UTC(p.y,p.m-1,p.d+((6-p.day+7)%7)));
 return utc.toISOString().slice(0,10);
}
function key(d){return saturdayISO(d)}
function load(){try{return JSON.parse(localStorage.getItem(STORAGE)||'{}')}catch{return {}}}
function havdalah(d){
 const obj=load(),raw=obj[key(d)];
 const ms=Date.parse(raw||'');
 return Number.isFinite(ms)?ms:null;
}
function onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}
function save(sat,iso){
 const obj=load();obj[sat]=iso;
 try{localStorage.setItem(STORAGE,JSON.stringify(obj))}catch(e){}
 listeners.forEach(fn=>{try{fn()}catch(e){}});
}
async function prime(d){
 const sat=key(d);if(cache.has(sat))return cache.get(sat);
 // Always refresh opportunistically, but cached data is enough offline throughout Shabbat.
 const promise=(async()=>{
  const url='https://www.hebcal.com/shabbat?cfg=json&geonameid=294801&b=18&M=on&date='+encodeURIComponent(sat);
  try{
   const res=await fetch(url);if(!res.ok)throw Error('Hebcal '+res.status);
   const data=await res.json();
   const item=(data.items||[]).find(i=>i.category==='havdalah'&&i.date&&localParts(new Date(i.date)).day===6);
   if(item&&Number.isFinite(Date.parse(item.date)))save(sat,item.date);
  }catch(e){console.warn('Could not refresh havdalah: using cached value if available',e)}
 })();
 cache.set(sat,promise);return promise;
}
function valid(r){return r&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end||'')&&r.end>r.start}
function tm(t){return (+t.slice(0,2))*60+(+t.slice(3))}
function display(d,data){
 const p=localParts(d),day=p.day,minutes=p.minutes;
 const cutoff=havdalah(d);
 const until=cutoff===null?null:cutoff+30*60000;
 // An unknown havdalah means the schedule must not falsely claim an exact cutoff.
 const cycle=day===5?'friday':day===6?'saturday':null;
 if(!cycle)return {rows:[],cutoff:until,unknown:false};
 if(cycle==='saturday'&&until!==null&&d.getTime()>=until)return {rows:[],cutoff:until,unknown:false,finished:true};
 let source=cycle==='friday'?data?.elevatorFriday:data?.elevatorSaturday;
 let rows=Array.isArray(source)?source.filter(valid).map(r=>({start:r.start,end:r.end,a:tm(r.start),b:tm(r.end),repeated:false})): [];
 if(day===6){
  // The Friday evening windows recur on Saturday evening until the elevator is stopped.
  const evening=Array.isArray(data?.elevatorFriday)?data.elevatorFriday.filter(valid):[];
  for(const r of evening){
   const a=tm(r.start),b=tm(r.end);
   // Stop at Havdalah +30. If no cached Havdalah, expose "unverified" status.
   const end=until===null?b:Math.min(b,localParts(new Date(until)).minutes);
   if(end>a) rows.push({start:r.start,end:r.end,a,b:end,repeated:true,cutoffTime:end<b?z2(Math.floor(end/60))+':'+z2(end%60):null});
  }
 }
 rows.sort((a,b)=>a.a-b.a);
 return {rows,cutoff:until,unknown:day===6&&until===null,minutes,day};
}
global.ShabbatElevator={prime,havdalah,onChange,display,saturdayISO,localParts};
})(window);
