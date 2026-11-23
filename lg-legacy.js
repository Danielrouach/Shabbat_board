/* LG UH617Y / webOS 3 legacy display runtime. ES5 only.
 * Never runs on browsers capable of the modern board.
 * Read-only: same Hebcal Haifa (294801) and cloud JSONP data source. */
(function (w, d) {
  'use strict';
/* This file is loaded normally for reliability, but runs only in obsolete LG TV engines. */
if(!/LG|webOS|Web0S|NetCast/i.test(navigator.userAgent))return;
try{new Function('var x={a:1};return x?.a;');return;}catch(compatibilityError){}
document.documentElement.className+=' lg-tv-board lg-legacy-runtime';
  var geo = '294801', weeklyKey = 'halachic_kiosk_weekly_v1';
  var days = ['יום ראשון','יום שני','יום שלישי','יום רביעי','יום חמישי','יום שישי','יום שבת'];
  var solar = {}, schedule = {}, heb = null, candles = null, havdalah = null, parasha = '', items = [], lastDay = '';
  var manualTheme = null, fetchedSolar = false, calendarVerified = false;
  function el(id) { return d.getElementById(id); }
  function txt(id, value) { var n = el(id); if (n) n.textContent = value === null || value === undefined ? '–' : String(value); }
  function p2(n) { return n < 10 ? '0' + n : String(n); }
  function iso(day) { return day.getFullYear() + '-' + p2(day.getMonth() + 1) + '-' + p2(day.getDate()); }
  function localDate(isoValue) { var parts = isoValue.split('-'); return new Date(+parts[0], +parts[1]-1, +parts[2], 12); }
  function hour(date) { return p2(date.getHours()) + ':' + p2(date.getMinutes()); }
  function validDate(v) { var x = new Date(v); return !isNaN(x.getTime()) ? x : null; }
  function time(v) { var x = validDate(v); return x ? hour(x) : '–'; }
  function addMinutes(v, amount) { var x = validDate(v); return x ? new Date(x.getTime() + amount*60000) : null; }
  function putTime(id, value) {
    var node = el(id), val = node && node.querySelector('.zman-time');
    if (val) val.textContent = value ? time(value) : '–';
    if (node) node.setAttribute('data-lg-time', value && validDate(value) ? validDate(value).getTime() : '');
  }
  function hidden(node, hide) { if (node) { node.hidden = !!hide; node.style.display = hide ? 'none' : ''; } }
  function clear(node) { if (node) while (node.firstChild) node.removeChild(node.firstChild); }
  function request(url, done) {
    var x;
    try {
      x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        if (x.status >= 200 && x.status < 300) {
          try { done(JSON.parse(x.responseText), null); }
          catch (e) { done(null, e); }
        } else done(null, new Error('HTTP ' + x.status));
      };
      x.onerror = function () { done(null, new Error('Network')); };
      x.send(null);
    } catch (e) { done(null, e); }
  }
  function cacheGet(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { return null; } }
  function cacheSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {} }
  function fallbackNote(message) { txt('last-updated', message); }
  function currentWeek(now) { var n = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);n.setDate(n.getDate()-n.getDay());return iso(n); }
  function currentSchedule(now) {
    var key = currentWeek(now), found = null, old = false, k;
    if (schedule[key]) return {data:schedule[key],old:false};
    for (k in schedule) if (schedule.hasOwnProperty(k) && /^20\d\d-\d\d-\d\d$/.test(k) && k < key && (!found || k > found)) found = k;
    return found ? {data:schedule[found],old:true} : {data:null,old:false};
  }
  function makeRow(label, value, klass) {
    var r = d.createElement('div'), a = d.createElement('span'), b = d.createElement('span');
    r.className = klass || 'weekly-entry';
    a.className = 'weekly-entry-label'; b.className = 'weekly-entry-time';
    a.textContent = label; b.textContent = value;
    r.appendChild(a); r.appendChild(b); return r;
  }
  function heading(str) { var e = d.createElement('div');e.className = 'weekly-heading';e.textContent = str;return e; }
  function validClock(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t || ''); }
  function plusClock(t,n) { if(!validClock(t))return '';var v = ((+t.slice(0,2))*60+(+t.slice(3))+n)%1440;return p2(Math.floor(v/60))+':'+p2(v%60); }
  function updateFeatureStatuses() {
    var features=[['prayersUpdatedAt','prayers-update-status','תפילות שארית ישראל'],['elevatorUpdatedAt','elevator-update-status','מעלית שבת']];
    for(var i=0;i<features.length;i++){
      var info=features[i],best=0,k,date,node=el(info[1]);
      if(!node)continue;
      for(k in schedule)if(schedule.hasOwnProperty(k)&&schedule[k]&&schedule[k][info[0]]){
        date=Date.parse(schedule[k][info[0]]);
        if(!isNaN(date)&&date>best)best=date;
      }
      if(best){
        date=new Date(best);
        node.textContent=info[2]+': עדכון אחרון '+p2(date.getDate())+'/'+p2(date.getMonth()+1)+'/'+date.getFullYear()+' '+hour(date);
        node.style.color='#91b7d4';
      }else{
        node.textContent=info[2]+': אין תאריך עדכון מתועד';
        node.style.color='#d5a464';
      }
    }
  }
  function initScreenButtons() {
    var full=el('fullscreen-btn'),awake=el('keep-awake-btn');
    if(full){
      full.textContent='⛶ מסך מלא';
      full.onclick=function(){
        var root=d.documentElement;
        var enter=root.requestFullscreen||root.webkitRequestFullscreen||root.webkitRequestFullScreen||root.msRequestFullscreen;
        var exit=d.exitFullscreen||d.webkitExitFullscreen||d.webkitCancelFullScreen||d.msExitFullscreen;
        try{
          if(d.fullscreenElement||d.webkitFullscreenElement){
            if(exit)exit.call(d);
          }else if(enter)enter.call(root);
          else w.alert('דפדפן LG אינו מאפשר מעבר למסך מלא דרך האתר. ניתן להשתמש בכפתור המסך המלא של דפדפן הטלוויזיה.');
        }catch(e){w.alert('בקשת המסך המלא לא נתמכה בטלוויזיה.');}
      };
      function fullLabel(){full.textContent=d.fullscreenElement||d.webkitFullscreenElement?'⤢ צא ממסך מלא':'⛶ מסך מלא';}
      d.addEventListener('fullscreenchange',fullLabel,false);
      d.addEventListener('webkitfullscreenchange',fullLabel,false);
    }
    if(awake){
      awake.textContent='◌ מסך פעיל: לא נתמך ב-LG';
      awake.title='גרסת webOS זו אינה תומכת ב-Screen Wake Lock; יש לבטל כיבוי אוטומטי בהגדרות הטלוויזיה';
      awake.onclick=function(){
        w.alert('בדפדפן הישן של LG אין תמיכה בנעילת מסך פעיל דרך אתר אינטרנט. יש לכבות טיימר שינה או כיבוי אוטומטי בהגדרות הטלוויזיה.');
      };
    }
  }
  function prayerBoard(now) {
    var week = currentSchedule(now), data = week.data || {}, day = now.getDay(), box = el('weekly-board'), p = el('weekly-prayers'), e = el('weekly-elevators');
    if (!p) return;
    clear(p); clear(e);
    var afterCandles = day === 5 && validClock(data.fridayCandles) && hour(now) >= data.fridayCandles;
    if (day === 6 || afterCandles) {
      p.appendChild(heading('בית הכנסת הרב אליהו אבוחצרא · שבת'));
      p.appendChild(makeRow('שחרית','08:00'));
    } else {
      p.appendChild(heading('בית הכנסת אור וישועה · ימי חול'));
      p.appendChild(makeRow('שחרית','07:10'));
      p.appendChild(heading('בית הכנסת רמב"ם · ימי חול'));
      p.appendChild(makeRow('שחרית','07:00'));
      p.appendChild(makeRow('שחרית','08:00'));
    }
    if (week.old) p.appendChild(heading('⚠ זמנים מהעדכון האחרון — לא עודכנו לשבוע הנוכחי'));
    var rows = [], combined = data.fridayMinchaArvit || '';
    if (/^\+\d{1,3}$/.test(combined)) combined = plusClock(data.fridayCandles || time(candles), +combined.slice(1));
    if (day < 5) {
      if (validClock(data.weekdayMincha)) rows.push(['מנחה',data.weekdayMincha]);
      if (validClock(data.weekdayArvit)) rows.push(['ערבית',data.weekdayArvit]);
    } else if (day === 5) {
      if (validClock(data.fridayMinchaGedola)) rows.push(['מנחה גדולה – ערב שבת',data.fridayMinchaGedola]);
      if (validClock(combined)) rows.push(['מנחה, קבלת שבת וערבית',combined]);
    } else {
      if (validClock(data.shabbatMinchaGedola)) rows.push(['מנחה גדולה',data.shabbatMinchaGedola]);
      if (validClock(data.shabbatMinchaKetana)) rows.push(['מנחה קטנה',data.shabbatMinchaKetana]);
      if (validClock(data.shabbatArvit)) rows.push(['ערבית מוצאי שבת',data.shabbatArvit]);
    }
    if (rows.length) {
      p.appendChild(heading('בית הכנסת שארית ישראל'));
      for (var i = 0; i < rows.length; i++) p.appendChild(makeRow(rows[i][0],rows[i][1]));
    }
    hidden(box,false);
    var weekday = day < 5 || (day === 5 && !afterCandles);
    hidden(el('prayer-times-heading'),!weekday);
    hidden(el('shabbat-times-heading'),!weekday);
    var widget = el('elevator-next-widget'), grid = el('elevator-next-rows');
    hidden(widget,true); clear(grid);
    var newest = null, key = currentWeek(now), k;
    for(k in schedule) {
      if (!schedule.hasOwnProperty(k) || k > key || !/^20\d\d-\d\d-\d\d$/.test(k)) continue;
      var candidate = schedule[k];
      if (candidate && ((candidate.elevatorFriday && candidate.elevatorFriday.length) || (candidate.elevatorSaturday && candidate.elevatorSaturday.length)) && (!newest || k > newest)) newest = k;
    }
    if (newest && (day === 5 || day === 6)) {
      var evs = schedule[newest], list = day === 5 ? evs.elevatorFriday : evs.elevatorSaturday;
      var found = [], mins = now.getHours()*60 + now.getMinutes(), j;
      if (list && list.length) for (j = 0; j < list.length; j++) if (list[j] && validClock(list[j].start) && validClock(list[j].end)) found.push(list[j]);
      if (day === 6 && evs.elevatorFriday && havdalah) {
        var cutoff = new Date(havdalah.getTime()+30*60000);
        if (now < cutoff) for (j=0;j<evs.elevatorFriday.length;j++) {
          var v = evs.elevatorFriday[j];
          if (v && validClock(v.start) && validClock(v.end) && (+v.start.slice(0,2))*60+(+v.start.slice(3)) >= (+hour(havdalah).slice(0,2))*60+(+hour(havdalah).slice(3))) found.push(v);
        }
      }
      found.sort(function(a,b){return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;});
      var shown = 0;
      for(j=0;j<found.length && shown<3;j++) {
        var v = found[j], end = (+v.end.slice(0,2))*60+(+v.end.slice(3));
        if(end > mins) {grid.appendChild(makeRow('פעילות מעלית',v.start+'–'+v.end));shown++;}
      }
      if (shown) hidden(widget,false);
    }
  }
  function renderZmanim(z) {
    var n = z.sunrise, sun = z.sunset, values = [
      ['z-alot-90',addMinutes(n,-90)],['z-alot-72',addMinutes(n,-72)],
      ['z-misheyakir',z.misheyakir],['z-netz',n],
      ['z-sof-shma',z.sofZmanShma],['z-chatzot',z.chatzot],
      ['z-shkia',sun],['z-tzeit',addMinutes(sun,18)]
    ];
    for(var i=0;i<values.length;i++) putTime(values[i][0],values[i][1]);
    var panel = el('left'), rows = panel ? panel.querySelectorAll('.zman-row') : [];
    var sorted = [], r;
    for(i=0;i<rows.length;i++) sorted.push(rows[i]);
    sorted.sort(function(a,b){return (+a.getAttribute('data-lg-time')||9999999999999)-(+b.getAttribute('data-lg-time')||9999999999999);});
    for(i=0;i<sorted.length;i++) panel.appendChild(sorted[i]);
    solar = z;
    applyTheme();
  }
  function renderShabbat(arr) {
    items = arr || [];
    var i, obj;
    candles = null; havdalah = null; parasha = '';
    for(i=0;i<items.length;i++){
      obj=items[i];
      if(obj.category==='candles')candles=validDate(obj.date);
      if(obj.category==='havdalah')havdalah=validDate(obj.date);
      if(obj.category==='parashat')parasha=obj.hebrew || obj.title || '';
    }
    txt('parasha-name',parasha || '–');
    txt('shabbat-big',parasha ? 'שבת ' + parasha.replace(/^פרשת\s*/, 'פרשת ') : 'שבת קודש');
    txt('val-candles',candles ? hour(candles) : '–');
    txt('val-havdalah',havdalah ? hour(havdalah) : '–');
    txt('val-rt',havdalah ? hour(new Date(havdalah.getTime()+30*60000)) : '–');
    prayerBoard(new Date());
  }
  function setHebDate(data) {
    heb=data;if(!data)return;
    var months={Nisan:'ניסן',Iyyar:'אייר',Sivan:'סיון',Tamuz:'תמוז',Av:'אב',Elul:'אלול',Tishrei:'תשרי',Cheshvan:'חשוון',Kislev:'כסלו',Tevet:'טבת',Shvat:'שבט',Adar:'אדר','Adar I':'אדר א׳','Adar II':'אדר ב׳'};
    var month = data.heDateParts && data.heDateParts.m || months[data.hm] || data.hm;
    txt('hebrew-date',(data.heDateParts && data.heDateParts.d || data.hd) + ' ' + month + ' ' + (data.heDateParts && data.heDateParts.y || data.hy));
    var monthNums={Nisan:1,Iyyar:2,Sivan:3,Tamuz:4,Av:5,Elul:6,Tishrei:7,Cheshvan:8,Kislev:9,Tevet:10,Shvat:11,Adar:12,'Adar I':13,'Adar II':14};
    var m=typeof data.hm==='number'?data.hm:(monthNums[data.hm]||0),n=+data.hd;
    if(!m || !n){hidden(el('tal-geshem-card'),true);hidden(el('barech-card'),true);return;}
    hidden(el('tal-geshem-card'),false);hidden(el('barech-card'),false);
    var rain = (m===7 && n>=22) || m===8 || m===9 || m===10 || m===11 || m===12 || m===6 || m===13 || m===14 || (m===1 && n<=22);
    txt('tal-geshem-value',rain?'משיב הרוח ומוריד הגשם':'מוריד הטל');
    txt('tal-geshem-sub','בתפילת שמונה עשרה');
    var barech=(m===8 && n>=7) || m===9 || m===10 || m===11 || m===12 || m===13 || m===14 || m===7 || (m===1 && n<15);
    txt('barech-value',barech?'ברך עלינו':'ברכנו');
    txt('barech-sub','בברכת השנים');
    updateTachanun();
  }
  function updateTachanun() {
    if(!heb)return;
    var map={Nisan:1,Iyyar:2,Sivan:3,Tamuz:4,Av:5,Elul:6,Tishrei:7,Cheshvan:8,Kislev:9,Tevet:10,Shvat:11,Adar:12,'Adar I':13,'Adar II':14};
    var m=typeof heb.hm==='number'?heb.hm:map[heb.hm],n=+heb.hd,now=new Date(),reason='',i;
    if(now.getDay()===6)reason='שבת קודש';
    else if(m===1)reason='חודש ניסן';
    else if(m===9 && n>=25 || m===10 && n<=3)reason='חנוכה';
    else if((m===6 || m===14) && (n===14 || n===15))reason='פורים';
    else if(m===2 && n===14)reason='פסח שני';
    else if(m===2 && n===18)reason='ל"ג בעומר';
    else if(m===3 && n<=12)reason='שבועות ואחריו';
    else if(m===5 && n===15)reason='ט"ו באב';
    else if(m===6 && n===29)reason='ערב ראש השנה';
    else if(m===7 && n<=2)reason='ראש השנה';
    else if(m===7 && n===9)reason='ערב יום כיפור';
    else if(m===7 && n===10)reason='יום כיפור';
    else if(m===7 && n>=15 && n<=23)reason='סוכות ושמיני עצרת';
    else if(m===11 && n===15)reason='ט"ו בשבט';
    for(i=0;i<items.length;i++) {
      var event=items[i];
      if(!event.date || event.date.slice(0,10)!==iso(now))continue;
      if(event.category==='roshchodesh')reason='ראש חודש';
      if(event.yomtov===true || event.category==='holiday')reason=event.hebrew || event.title || 'יום טוב';
    }
    var card=el('tachanun-card');
    // Only state the conclusion when calendar data for today was received;
    // on offline first load, no-tachanun cannot reliably be inferred.
    if(!calendarVerified){hidden(card,true);return;}
    hidden(card,false);
    txt('tachanun-value',reason?'אין תחנון':'יש תחנון');
    txt('tachanun-reason',reason);
  }
  function renderWeeklyCalendarCards(events,day) {
    // Same selection windows as the modern board: Sunday through Saturday,
    // with upcoming holidays only and Rosh Chodesh anywhere in that week.
    var now=localDate(day),sun=new Date(now.getTime()),sat,holidayToday=null,
        holidayUpcoming=null,rcToday=null,rcWeek=null,i,ev,key,cat,rc,major;
    sun.setDate(sun.getDate()-sun.getDay());
    sat=new Date(sun.getTime());sat.setDate(sat.getDate()+6);
    var from=iso(sun),until=iso(sat);
    for(i=0;i<events.length;i++){
      ev=events[i];
      if(!ev||!ev.date)continue;
      key=String(ev.date).slice(0,10);
      if(key<from||key>until)continue;
      cat=ev.category||'';
      major=cat==='holiday'||cat==='major'||ev.subcat==='major';
      rc=cat==='roshchodesh'||!!(ev.title&&ev.title.indexOf('Rosh Chodesh')===0);
      if(major&&key===day&&!holidayToday)holidayToday=ev;
      if((cat==='holiday'||cat==='major')&&key>=day&&!holidayUpcoming)holidayUpcoming=ev;
      if(rc&&key===day&&!rcToday)rcToday=ev;
      if(rc&&!rcWeek)rcWeek=ev;
    }
    var holiday=holidayToday||holidayUpcoming,rosh=rcToday||rcWeek;
    var hlabel=holiday&&(holiday.hebrew||holiday.title);
    var rlabel=rosh&&(rosh.hebrew||rosh.title);
    hidden(el('holiday-card'),!hlabel);
    if(hlabel)txt('holiday-value',hlabel);
    hidden(el('roshchodesh-card'),!rlabel);
    if(rlabel)txt('roshchodesh-value',rlabel);
  }
  function readAll() {
    var day = iso(new Date()), root='https://www.hebcal.com/';
    if (lastDay===day) return;
    lastDay=day;
    var stored=cacheGet('lg_tv_board_cache_v1');
    if (stored && stored.date===day) {
      if(stored.z)renderZmanim(stored.z);
      if(stored.heb)setHebDate(stored.heb);
      if(stored.shabbat)renderShabbat(stored.shabbat);
    }
    function savePart(k,v) {
      var c=cacheGet('lg_tv_board_cache_v1');
      if(!c || c.date!==day)c={date:day};
      c[k]=v;cacheSet('lg_tv_board_cache_v1',c);
    }
    request(root+'zmanim?cfg=json&geonameid='+geo+'&date='+day+'&sec=1',function(data,err){
      if(data && data.times){
        renderZmanim(data.times);savePart('z',data.times);
        fallbackNote('זמני היום עודכנו: '+hour(new Date()));
      } else fallbackNote('⚠ זמני היום לא נטענו – יבוצע ניסיון חוזר');
    });
    request(root+'shabbat?cfg=json&geonameid='+geo+'&m=18&b=18&M=on',function(data,err){
      if(data && data.items){renderShabbat(data.items);savePart('shabbat',data.items);}
    });
    request(root+'converter?cfg=json&date='+day+'&g2h=1&strict=1',function(data,err){
      if(data && data.hy){setHebDate(data);savePart('heb',data);}
    });
    request(root+'hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&mf=on&ss=on&year='+day.slice(0,4)+'&month='+day.slice(5,7)+'&geo=geoname&geonameid='+geo+'&M=on',function(data,err){
      if(!data || !data.items)return;
      items=data.items;
      calendarVerified=true;
      updateTachanun();
      renderWeeklyCalendarCards(data.items,day);
    });
  }
  function refreshCloud() {
    var url=w.SHABBAT_CLOUD_READ_URL;
    if(!url || url.indexOf('https://script.google.com/macros/s/')!==0)return;
    var name='shabbatCloudCallback_'+String(new Date().getTime())+String(Math.floor(Math.random()*10000)), sc=d.createElement('script'), done=false;
    function finish(){if(done)return;done=true;try{delete w[name];}catch(e){w[name]=null;}if(sc.parentNode)sc.parentNode.removeChild(sc);}
    w[name]=function(result) {
      if(result && result.ok===true && result.data && result.data.format==='halachic-weekly-v1' && result.data.weeks && typeof result.data.weeks==='object'){
        var newData=result.data.weeks, k;
        for(k in newData)if(newData.hasOwnProperty(k) && /^20\d\d-\d\d-\d\d$/.test(k) && newData[k] && typeof newData[k]==='object')schedule[k]=newData[k];
        cacheSet(weeklyKey,schedule);
        prayerBoard(new Date());
        updateFeatureStatuses();
        txt('legacy-status','נתוני הענן נטענו · תצוגת LG פעילה');
      } else txt('legacy-status','⚠ שירות הנתונים החזיר תשובה לא תקינה');
      finish();
    };
    sc.onerror=function(){txt('legacy-status','⚠ לא ניתן להתחבר לשרת התפילות והמעלית');finish();};
    sc.src=url+(url.indexOf('?')>=0?'&':'?')+'callback='+encodeURIComponent(name)+'&t='+new Date().getTime();
    (d.head||d.getElementsByTagName('head')[0]).appendChild(sc);
    setTimeout(function(){
      if(!done)txt('legacy-status','⚠ שרת הנתונים לא השיב; מוצגים נתונים שמורים בלבד');
      finish();
    },20000);
  }
  function applyTheme(){
    var auto=true;
    try{auto=localStorage.getItem('rouach_shabbat_theme_auto_v1')!=='false';}catch(e){}
    var mode=manualTheme;
    if(!mode && auto && solar.sunrise && solar.sunset) {
      var now=new Date(), rise=validDate(solar.sunrise),set=validDate(solar.sunset);
      if(rise && set) mode=(now>=rise && now<set)?'light':'dark';
    }
    if(!mode){try{mode=localStorage.getItem('rouach_shabbat_theme_v1')||'dark';}catch(e){mode='dark';}}
    d.documentElement.className=d.documentElement.className.replace(/\s*light-theme/g,'')+(mode==='light'?' light-theme':'');
    var buttons=d.querySelectorAll('[data-theme-toggle]'), checks=d.querySelectorAll('[data-theme-auto]'),i;
    for(i=0;i<buttons.length;i++)buttons[i].textContent=mode==='light'?'☾ מצב כהה':'☀ מצב בהיר';
    for(i=0;i<checks.length;i++)checks[i].checked=auto;
  }
  function bindTheme(){
    var buttons=d.querySelectorAll('[data-theme-toggle]'), checks=d.querySelectorAll('[data-theme-auto]'), i;
    for(i=0;i<buttons.length;i++)buttons[i].onclick=function(){
      var mode=d.documentElement.className.indexOf('light-theme')>=0?'dark':'light';
      manualTheme=mode;
      try{localStorage.setItem('rouach_shabbat_theme_v1',mode);}catch(e){}
      applyTheme();
    };
    for(i=0;i<checks.length;i++)checks[i].onchange=function(){
      try{localStorage.setItem('rouach_shabbat_theme_auto_v1',this.checked?'true':'false');}catch(e){}
      if(this.checked)manualTheme=null;
      applyTheme();
    };
  }
  function tick(){
    var now=new Date();
    txt('ch',p2(now.getHours()));txt('cm',p2(now.getMinutes()));txt('cs',p2(now.getSeconds()));
    txt('shabbat-clock',hour(now)+':'+p2(now.getSeconds()));
    txt('day-of-week-left',days[now.getDay()]);
    txt('gregorian-date',p2(now.getDate())+'/'+p2(now.getMonth()+1)+'/'+now.getFullYear());
    if(lastDay!==iso(now))readAll();
    if(now.getSeconds()===0) {
      prayerBoard(now);
      applyTheme();
    }
    var shabbat = candles && havdalah && now>=candles && now < new Date(havdalah.getTime()+30*60000);
    if(shabbat){
      d.body.className=d.body.className.indexOf('shabbat-day')>=0?d.body.className:d.body.className+' shabbat-day';
    }else d.body.className=d.body.className.replace(/\s*shabbat-day/g,'');
    var logo=el('shabbat-kodesh-block'), clock=el('clock');
    hidden(logo,!shabbat);hidden(clock,shabbat);
    var small=el('shabbat-clock');hidden(small,!shabbat);
  }
  function safeTick(){
    try{tick();}catch(e){
      var n=el('legacy-status');
      if(n)n.textContent='⚠ שגיאת תצוגה: '+String(e.message||e).slice(0,65);
    }
  }
  function start(){
    /* Clock first; errors in initialization or data cannot stop the clock. */
    safeTick();
    setInterval(safeTick,1000);
    try{
      hidden(el('loading-overlay'),true);
      hidden(el('settings-btn'),true);
      hidden(el('weekly-open-btn'),true);
      hidden(el('weekly-panel'),true);
      hidden(el('omer-card'),true);
      hidden(el('roshchodesh-card'),true);
      hidden(el('holiday-card'),true);
      hidden(el('tachanun-card'),true);
      schedule=cacheGet(weeklyKey)||{};
      initScreenButtons();bindTheme();applyTheme();
      prayerBoard(new Date());updateFeatureStatuses();
      txt('legacy-status','מנוע LG פעיל · בודק נתונים');
    }catch(e){
      txt('legacy-status','⚠ אתחול חלקי: '+String(e.message||e).slice(0,65));
    }
    try{readAll();}catch(e){txt('legacy-status','⚠ קריאת לוח נכשלה');}
    try{refreshCloud();}catch(e){txt('legacy-status','⚠ קריאת ענן נכשלה');}
    setInterval(function(){lastDay='';try{readAll();}catch(e){}},30*60*1000);
    setInterval(function(){try{refreshCloud();}catch(e){}},15*60*1000);
  }
  if(d.readyState==='complete'||d.readyState==='interactive')setTimeout(start,0);
  else d.addEventListener('DOMContentLoaded',start,false);
})(window,document);
