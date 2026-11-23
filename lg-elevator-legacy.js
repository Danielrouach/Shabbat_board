/* Isolated ES5 elevator display for legacy LG webOS 3 (UH617Y).
   Read-only; never writes to the administration API. */
(function(w,d){
'use strict';
var STORE='halachic_kiosk_weekly_v1', db={},parasha='',havdalah=null,solar={},cloud='pending',cloudErr='',lastDay='';
function el(id){return d.getElementById(id)}
function txt(id,s){var n=el(id);if(n)n.textContent=s}
function pad(n){return n<10?'0'+n:String(n)}
function iso(x){return x.getFullYear()+'-'+pad(x.getMonth()+1)+'-'+pad(x.getDate())}
function minutes(x){return (+x.slice(0,2))*60+(+x.slice(3))}
function valid(r){return r&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.start||'')&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r.end||'')&&r.end>r.start}
function saturday(now){var n=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);n.setDate(n.getDate()+((6-n.getDay()+7)%7));return iso(n)}
function week(now){var n=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);n.setDate(n.getDate()-n.getDay());return iso(n)}
function save(){try{localStorage.setItem(STORE,JSON.stringify(db))}catch(e){}}
function load(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch(e){return {}}}
function displayDate(x){return pad(x.getDate())+'/'+pad(x.getMonth()+1)+'/'+x.getFullYear()}
function clear(e){while(e&&e.firstChild)e.removeChild(e.firstChild)}
function hidden(e,v){if(e){e.hidden=!!v;e.style.display=v?'none':''}}
function fetchJson(url,cb){
 try{var req=new XMLHttpRequest();req.open('GET',url,true);
 req.onreadystatechange=function(){if(req.readyState===4){if(req.status>=200&&req.status<300){try{cb(JSON.parse(req.responseText))}catch(e){cb(null)}}else cb(null)}};
 req.onerror=function(){cb(null)};req.send(null)}catch(e){cb(null)}
}
function newestElevator(now){
 var chosen='',k,key=week(now);
 for(k in db)if(db.hasOwnProperty(k)&&/^20\d\d-\d\d-\d\d$/.test(k)&&k<=key&&db[k]){
  var v=db[k];if((v.elevatorFriday&&v.elevatorFriday.length)||(v.elevatorSaturday&&v.elevatorSaturday.length)){
   if(!chosen||k>chosen)chosen=k;
  }
 }
 return {data:chosen?db[chosen]:null,source:chosen,old:!!chosen&&chosen!==key};
}
function latestUpdate(){
 var date=0,k,x;
 for(k in db)if(db.hasOwnProperty(k)&&db[k]&&db[k].elevatorUpdatedAt){
  x=Date.parse(db[k].elevatorUpdatedAt);
  if(!isNaN(x)&&x>date)date=x;
 }
 if(!date)return '⚠ אין תאריך עדכון מתועד למעלית';
 var saved=new Date(date);
 return 'עדכון אחרון למעלית: '+displayDate(saved)+' '+pad(saved.getHours())+':'+pad(saved.getMinutes());
}
function rowsFor(now,source){
 var data=source.data||{},day=now.getDay(),preview=day!==5&&day!==6;
 var r=[],i,v,origin=[],minutesNow=now.getHours()*60+now.getMinutes();
 function collect(a,label,repeated){
  if(!a)return;
  for(var j=0;j<a.length;j++){
   v=a[j];if(!valid(v))continue;
   var end=minutes(v.end),start=minutes(v.start),caption=label;
   if(repeated){
    if(!havdalah)continue; // No verified repeat without a cutoff.
    var cutoff=havdalah.getTime()+30*60000;
    if(now.getTime()>=cutoff)continue;
    var cutoffDate=new Date(cutoff),cutoffMinutes=cutoffDate.getHours()*60+cutoffDate.getMinutes();
    if(start>=cutoffMinutes)continue;
    end=Math.min(end,cutoffMinutes);
    if(end<=start)continue;
    caption='מחזור מוצאי שבת';
   }
   r.push({start:v.start,end:pad(Math.floor(end/60))+':'+pad(end%60),a:start,b:end,caption:caption});
  }
 }
 if(preview){collect(data.elevatorFriday,'ערב שבת',false);collect(data.elevatorSaturday,'יום שבת',false)}
 else if(day===5)collect(data.elevatorFriday,'ערב שבת',false);
 else if(day===6){collect(data.elevatorSaturday,'יום שבת',false);collect(data.elevatorFriday,'מוצאי שבת',true)}
 r.sort(function(a,b){return a.a-b.a});
 return {rows:r,preview:preview,minute:preview?-1:minutesNow};
}
function render(){
 var now=new Date(),day=now.getDay(),sat=saturday(now),source=newestElevator(now),found=rowsFor(now,source),arr=found.rows,grid=el('tiles'),empty=el('empty'),status=el('status');
 txt('clock',pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds()));
 txt('date',displayDate(now));
 txt('weekRange','שבת '+displayDate(new Date(+sat.slice(0,4),+sat.slice(5,7)-1,+sat.slice(8,10))));
 txt('dayLabel',found.preview?'תצוגה מקדימה · שבת הקרובה':day===5?'ערב שבת · יום שישי':'שבת קודש');
 txt('parashaTitle',parasha?'זמני מעלית שבת לפרשת '+parasha.replace(/^(?:פרשת\s*)+/,''):'זמני מעלית שבת');
 clear(grid);
 for(var i=0;i<arr.length;i++){
  var r=arr[i],tile=d.createElement('div'),tm=d.createElement('div'),caption=d.createElement('div');
  var active=!found.preview&&found.minute>=r.a&&found.minute<r.b;
  tile.className='tile'+(found.preview?' preview':active?' current':r.b<=found.minute?' past':'');
  tm.className='time';tm.textContent=r.start+'–'+r.end;
  caption.className='caption';
  caption.textContent=found.preview?r.caption:active?'פעיל עכשיו':r.b<=found.minute?'הסתיים':r.caption;
  tile.appendChild(tm);tile.appendChild(caption);grid.appendChild(tile);
 }
 hidden(grid,arr.length===0);hidden(empty,arr.length>0);
 if(!arr.length)txt('empty',!source.data?(cloud==='error'?'לא ניתן לטעון זמני מעלית – אין נתונים שמורים':'ממתין לנתוני המעלית'):day===6&&havdalah&&now.getTime()>=havdalah.getTime()+30*60000?'פעילות המעלית הסתיימה':'אין חלונות מעלית מוגדרים למועד זה');
 var message=latestUpdate()+' · '+(cloud==='error'?'⚠ חיבור הענן נכשל, משתמש בנתונים שמורים':cloud==='pending'?'בודק נתונים בענן':'נתוני הענן נבדקו');
 if(source.old)message+=' · ⚠ לוח מעלית משבוע קודם';
 if(day===6&&!havdalah)message+=' · ⚠ זמן עצירה לא אומת';
 txt('status',message);
 if(lastDay!==iso(now)){lastDay=iso(now);loadCalendar(now)}
}
function loadCalendar(now){
 var date=iso(now),sat=saturday(now),cached;
 try{cached=JSON.parse(localStorage.getItem('lg_elevator_calendar_v1')||'null')}catch(e){cached=null}
 if(cached&&cached.sat===sat){parasha=cached.parasha||'';if(cached.havdalah)havdalah=new Date(cached.havdalah)}
 fetchJson('https://www.hebcal.com/shabbat?cfg=json&geonameid=294801&b=18&M=on&date='+sat,function(data){
  if(!data||!data.items)return;
  var h=null,p='',i,e;
  for(i=0;i<data.items.length;i++){
   e=data.items[i];
   if(e.category==='parashat')p=e.hebrew||e.title||'';
   if(e.category==='havdalah')h=e.date||null;
  }
  if(p)parasha=p;
  if(h&& !isNaN(new Date(h).getTime()))havdalah=new Date(h);
  try{localStorage.setItem('lg_elevator_calendar_v1',JSON.stringify({sat:sat,parasha:parasha,havdalah:h}))}catch(err){}
  render();
 });
 fetchJson('https://www.hebcal.com/converter?cfg=json&date='+date+'&g2h=1&strict=1',function(data){
  if(data&&data.hy){var m=data.heDateParts&&data.heDateParts.m||data.hm;txt('hebrewDate',data.hd+' '+m+' '+data.hy)}
 });
 fetchJson('https://www.hebcal.com/zmanim?cfg=json&geonameid=294801&date='+date+'&sec=1',function(data){
  if(data&&data.times)solar=data.times;
  theme();
 });
}
function cloudRefresh(){
 var url=w.SHABBAT_CLOUD_READ_URL;if(!url||url.indexOf('https://script.google.com/macros/s/')!==0){cloud='error';render();return}
 var callback='shabbatCloudCallback_'+new Date().getTime()+Math.floor(Math.random()*10000),tag=d.createElement('script'),done=false;
 function clean(){if(done)return;done=true;try{delete w[callback]}catch(e){w[callback]=null}if(tag.parentNode)tag.parentNode.removeChild(tag)}
 w[callback]=function(result){
  if(result&&result.ok===true&&result.data&&result.data.format==='halachic-weekly-v1'&&result.data.weeks){
   var incoming=result.data.weeks,k;
   for(k in incoming)if(incoming.hasOwnProperty(k)&&/^20\d\d-\d\d-\d\d$/.test(k)&&incoming[k]&&typeof incoming[k]==='object')db[k]=incoming[k];
   save();cloud='ready';
  }else cloud='error';
  clean();render();
 };
 tag.onerror=function(){clean();cloud='error';render()};
 tag.src=url+(url.indexOf('?')>=0?'&':'?')+'callback='+encodeURIComponent(callback)+'&t='+new Date().getTime();
 (d.head||d.getElementsByTagName('head')[0]).appendChild(tag);
 setTimeout(function(){if(!done){clean();cloud='error';render()}},20000);
}
var override=null;
function theme(){
 var auto=true,mode=override;
 try{auto=localStorage.getItem('rouach_shabbat_theme_auto_v1')!=='false'}catch(e){}
 if(!mode&&auto&&solar.sunrise&&solar.sunset){
  var rise=new Date(solar.sunrise),set=new Date(solar.sunset),now=new Date();
  if(!isNaN(rise.getTime())&&!isNaN(set.getTime()))mode=now>=rise&&now<set?'light':'dark';
 }
 if(!mode)try{mode=localStorage.getItem('rouach_shabbat_theme_v1')||'dark'}catch(e){mode='dark'}
 d.documentElement.className=d.documentElement.className.replace(/\s*light-theme/g,'')+(mode==='light'?' light-theme':'');
 txt('theme-toggle',mode==='light'?'☾ מצב כהה':'☀ מצב בהיר');
 var check=d.querySelector('[data-theme-auto]');if(check)check.checked=auto;
}
function bindButtons(){
 var b=el('theme-toggle'),check=d.querySelector('[data-theme-auto]'),full=el('fullscreen-btn'),awake=el('keep-awake-btn');
 if(b)b.onclick=function(){
  override=d.documentElement.className.indexOf('light-theme')>=0?'dark':'light';
  try{localStorage.setItem('rouach_shabbat_theme_v1',override)}catch(e){}
  theme();
 };
 if(check)check.onchange=function(){try{localStorage.setItem('rouach_shabbat_theme_auto_v1',check.checked?'true':'false')}catch(e){}if(check.checked)override=null;theme()};
 if(full)full.onclick=function(){
  var root=d.documentElement,go=root.requestFullscreen||root.webkitRequestFullscreen||root.webkitRequestFullScreen,exit=d.exitFullscreen||d.webkitExitFullscreen||d.webkitCancelFullScreen;
  try{if(d.fullscreenElement||d.webkitFullscreenElement){if(exit)exit.call(d)}else if(go)go.call(root);else w.alert('מסך מלא מתוך האתר אינו נתמך ב-LG. השתמש בכפתור מסך מלא של הדפדפן.')}
  catch(e){w.alert('אין תמיכה בהפעלת מסך מלא מתוך האתר בטלוויזיה זו')}
 };
 if(awake){awake.textContent='◌ מסך פעיל: לא נתמך ב-LG';awake.onclick=function(){w.alert('גרסת webOS זו אינה תומכת ב-Screen Wake Lock. בטל טיימר שינה וכיבוי אוטומטי בהגדרות הטלוויזיה.')}}
}
function start(){
 db=load();hidden(el('qa-controls'),true);bindButtons();theme();render();cloudRefresh();
 setInterval(render,1000);setInterval(cloudRefresh,5*60*1000);
 setInterval(function(){theme();},15000);
}
if(d.readyState==='complete'||d.readyState==='interactive')setTimeout(start,0);
else d.addEventListener('DOMContentLoaded',start,false);
})(window,document);
