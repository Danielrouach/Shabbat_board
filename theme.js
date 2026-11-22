/* Shared theme selection for both Shabbat Board displays.
   Persist per-browser and sync changes between open tabs/windows. */
(function(){
  'use strict';
  const KEY='rouach_shabbat_theme_v1';
  function selected(){
    // Explicit theme handoff when opening the elevator from the main board.
    // Same-origin localStorage remains the default for direct visits/reloads.
    const requested=new URLSearchParams(location.search).get('theme');
    if(requested==='light'||requested==='dark'){
      try{localStorage.setItem(KEY,requested)}catch(_){}
      return requested;
    }
    try{return localStorage.getItem(KEY)==='light'?'light':'dark'}
    catch(_){return 'dark'}
  }
  function apply(mode){
    const light=mode==='light';
    document.documentElement.classList.toggle('light-theme',light);
    document.documentElement.style.colorScheme=light?'light':'dark';
    const elevatorLinks=document.querySelectorAll('a[href^="elevator.html"]');
    for(const link of elevatorLinks)link.href='elevator.html?theme='+(light?'light':'dark');
    const buttons=document.querySelectorAll('[data-theme-toggle]');
    for(const button of buttons){
      button.textContent=light?'☾ מצב כהה':'☀ מצב בהיר';
      button.setAttribute('aria-pressed',String(light));
      button.title=light?'מעבר למצב כהה':'מעבר למצב בהיר';
    }
    if(typeof window.requestColumnFit==='function')window.requestColumnFit();
  }
  function toggle(){
    const next=document.documentElement.classList.contains('light-theme')?'dark':'light';
    try{localStorage.setItem(KEY,next)}catch(_){}
    // A theme handoff query parameter is only for initial navigation, not
    // a permanent override after the visitor changes theme on this page.
    if(new URLSearchParams(location.search).has('theme')){
      const url=new URL(location.href);
      url.searchParams.delete('theme');
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
    apply(next);
  }
  // Install before first frame to avoid a light-to-dark flash.
  apply(selected());
  document.addEventListener('DOMContentLoaded',()=>{
    apply(selected());
    document.querySelectorAll('[data-theme-toggle]').forEach(b=>b.addEventListener('click',toggle));
  });
  window.addEventListener('storage',e=>{if(e.key===KEY)apply(selected())});
  window.ShabbatTheme={toggle,apply,get:selected};
})();