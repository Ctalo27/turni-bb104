/* ═══ STATO UI ═══ */
let curYear=Math.max(MIN_YEAR,_cy),view='cal',picked=null,sheetKey=null;
let minRenderedYear=Math.max(MIN_YEAR,_cy-1),maxRenderedYear=Math.max(_cy+1,Math.max(MIN_YEAR,_cy-1)+2),calendarExtending=false;
let undoStack=[];

function snapshot(){undoStack.push(JSON.stringify(M));if(undoStack.length>15)undoStack.shift();showUndo();}
let uT;
function showUndo(){const u=document.getElementById('undo');u.classList.add('show');clearTimeout(uT);uT=setTimeout(hideUndo,6000);}
function hideUndo(){document.getElementById('undo').classList.remove('show');}

/* ogni mutazione di M passa da qui: cache, render e salvataggio */
function commit(msg){
  invalidate();
  try{renderAll();}
  catch(err){
    if(undoStack.length){M=JSON.parse(undoStack.pop());invalidate();try{renderAll();}catch(e2){}}
    toast('⚠️ Operazione annullata: dati incoerenti');
    return;
  }
  save();
  if(msg)toast(msg);
}
function doUndo(){
  if(!undoStack.length)return;
  M=JSON.parse(undoStack.pop());
  invalidate();renderAll();save();
  toast('↶ Annullato');
  if(!undoStack.length)hideUndo();
}

/* ═══ COUNTDOWN & LIVE ═══ */
function getNextShiftStart(){
  const now=liveNow();
  for(let i=0;i<=14;i++){
    const dt=addDays(now,i);
    const st=state(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    if(!st.work)continue;
    for(const sh of shiftsOf(st.k)){
      const[h,m]=sh.s.split(':').map(Number);
      const start=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),h,m,0);
      if(start>now)return{start,k:st.k,shift:sh};
    }
  }
  return null;
}
function getCurrentShift(k){
  const now=liveNow();
  const base=fromKey(k);
  for(const sh of shiftsOf(k)){
    const[sh1,sm]=sh.s.split(':').map(Number),[eh,em]=sh.e.split(':').map(Number);
    const start=new Date(base.getFullYear(),base.getMonth(),base.getDate(),sh1,sm,0);
    let end=new Date(base.getFullYear(),base.getMonth(),base.getDate(),eh,em,0);
    if(end<=start)end=new Date(base.getFullYear(),base.getMonth(),base.getDate()+1,eh,em,0);
    if(now>=start&&now<end)return{end,shift:sh};
  }
  return null;
}
/* turno in corso: controlla anche ieri (turni 22:00→06:00 a cavallo di mezzanotte) */
function findOngoing(){
  const now=liveNow();
  const keys=[keyOf(addDays(now,-1)),keyOf(now)];
  for(const k of keys){
    const s=stateK(k);
    if(!s.work)continue;
    const cur=getCurrentShift(k);
    if(cur)return{...cur,k};
  }
  return null;
}
function fmtCountdown(ms){
  if(ms<=0)return null;
  const totalMin=Math.floor(ms/60000);
  const h=Math.floor(totalMin/60),m=totalMin%60;
  if(h===0)return `tra ${m} min`;
  return m>0?`tra ${h}h ${m}m`:`tra ${h}h`;
}
/* countdown per una data di inizio: usa i giorni di CALENDARIO, non blocchi di 24h */
function fmtCountdownDate(start){
  const now=liveNow();
  const ms=start-now;
  if(ms<=0)return null;
  const dayDiff=Math.round((new Date(start.getFullYear(),start.getMonth(),start.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/864e5);
  const totalMin=Math.floor(ms/60000);
  const h=Math.floor(totalMin/60),m=totalMin%60;
  if(dayDiff===0)return h===0?`tra ${m} min`:(m>0?`tra ${h}h ${m}m`:`tra ${h}h`);
  if(dayDiff===1)return start.getHours()<7?`stanotte alle ${pad2(start.getHours())}:${pad2(start.getMinutes())}`:`domani alle ${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  return `tra ${dayDiff} giorni`;
}
function remainingShiftsMonth(){
  const now=liveNow(),y=now.getFullYear(),m=now.getMonth()+1;
  const ld=new Date(y,m,0).getDate();
  let rem=0;
  for(let dd=now.getDate();dd<=ld;dd++)if(state(y,m,dd).work)rem++;
  return rem;
}

/* rollover di mezzanotte + risveglio da background (PWA iOS resta viva per giorni) */
let lastDayKey=null,_tcTimer=null;
function refreshLive(){
  const nk=liveTodayKey();
  if(nk!==lastDayKey){
    lastDayKey=nk;
    invalidate();render();
  } else {renderTodayCard();renderLiveStrip();}
}
function startLiveTimer(){
  clearInterval(_tcTimer);
  _tcTimer=setInterval(refreshLive,30000);
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){invalidate();refreshLive();}
});
window.addEventListener('pageshow',e=>{if(e.persisted){invalidate();refreshLive();}});

/* mostra il riepilogo compatto soltanto quando la scheda di oggi non e' piu' visibile */
function updateLiveStripVisibility(){
  const hdr=document.querySelector('.hdr');
  const card=document.querySelector('.today-card');
  if(!hdr||!card)return;
  const hidden=view==='cal'&&card.getBoundingClientRect().bottom<=hdr.getBoundingClientRect().bottom+8;
  hdr.classList.toggle('live-visible',hidden);
}
let pageScrollFrame=null;
function onPageScroll(){
  if(pageScrollFrame)return;
  pageScrollFrame=requestAnimationFrame(()=>{pageScrollFrame=null;updateLiveStripVisibility();updateVisibleYear();extendCalendar();});
}
window.addEventListener('scroll',onPageScroll,{passive:true});
window.addEventListener('resize',updateLiveStripVisibility);

/* ═══ CONDIVISIONE ═══ */
function switchMessage(sw){
  const from=fromKey(sw.from),to=fromKey(sw.to);
  return `Dovrei fare uno switch in Week ${weekNumber(sw.from)}, dovrei riposare il giorno ${from.getDate()} ${MN[from.getMonth()].toLowerCase()} (giorno in cui lavoro) e lavorare il giorno ${to.getDate()} ${MN[to.getMonth()].toLowerCase()} (giorno in cui riposo).`;
}
function showSwitchMessage(text){
  const area=document.getElementById('switch-copy');
  area.value=text;
  const sb=document.getElementById('switch-share-btn');
  if(sb)sb.style.display=navigator.share?'':'none';
  document.getElementById('m-switch').classList.add('show');
}
function closeSwitchMessage(){
  document.getElementById('switch-copy').blur();
  document.getElementById('m-switch').classList.remove('show');
}
function showCopyConfirmation(){document.getElementById('m-copied').classList.add('show');}
function closeCopyConfirmation(){document.getElementById('m-copied').classList.remove('show');}
function copySwitchMessage(){
  const area=document.getElementById('switch-copy');
  area.focus();area.select();area.setSelectionRange(0,area.value.length);
  let copied=false;
  try{copied=document.execCommand('copy');}catch(e){}
  if(copied){closeSwitchMessage();showCopyConfirmation();return;}
  if(navigator.clipboard){
    navigator.clipboard.writeText(area.value).then(()=>{closeSwitchMessage();showCopyConfirmation();}).catch(()=>toast('Testo selezionato: tieni premuto e scegli Copia'));
  } else toast('Testo selezionato: tieni premuto e scegli Copia');
}
function shareSwitch(sw){
  haptic();
  _lastSwitchWeek=weekNumber(sw.from);
  showSwitchMessage(switchMessage(sw));
}
let _lastSwitchWeek=null;
function nativeShareSwitch(){
  const text=document.getElementById('switch-copy').value;
  if(!navigator.share)return;
  navigator.share({title:_lastSwitchWeek?`Switch Week ${_lastSwitchWeek}`:'Switch',text})
    .catch(err=>{if(err&&err.name!=='AbortError')toast('Condivisione annullata');});
}
/* ═══ PWA ═══ */
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function isStandalone(){return navigator.standalone===true||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches);}
let _deferredInstall=null;

function setupPWA(){
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost')){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
    let hadCtrl=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadCtrl)toast('✨ App aggiornata all\'ultima versione');
      hadCtrl=true;
    });
  }
  try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}

  if(isStandalone())return; // già installata: niente banner
  const dismissed=CAN_STORE&&localStorage.getItem('bb104install-dismissed');
  if(dismissed)return;

  if(isIOS){
    // iOS non ha beforeinstallprompt: istruzioni manuali
    document.getElementById('ib-tx').innerHTML='📲 Installa l\'app<small>Tocca <b>Condividi</b> (⬆️) poi <b>“Aggiungi alla schermata Home”</b></small>';
    document.getElementById('install-banner').classList.add('show');
  } else {
    window.addEventListener('beforeinstallprompt',e=>{
      e.preventDefault();
      _deferredInstall=e;
      document.getElementById('install-btn').style.display='block';
      document.getElementById('install-banner').classList.add('show');
    });
    window.addEventListener('appinstalled',()=>{
      document.getElementById('install-banner').classList.remove('show');
      _deferredInstall=null;
      toast('✅ App installata!');
    });
  }
}
function installPWA(){
  haptic();
  if(_deferredInstall){
    _deferredInstall.prompt();
    _deferredInstall.userChoice.then(()=>{_deferredInstall=null;});
  }
}
function dismissInstall(){
  document.getElementById('install-banner').classList.remove('show');
  if(CAN_STORE)try{localStorage.setItem('bb104install-dismissed','1');}catch(e){}
}

/* ═══ HAPTIC ═══ */
function haptic(ms=8){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}}

/* ═══ DIALOGS ═══ */
function askConfirm(title,msg,cb){
  document.getElementById('ask-title').textContent=title;
  document.getElementById('ask-msg').textContent=msg;
  document.getElementById('ask-input').style.display='none';
  document.getElementById('ask-ok').onclick=()=>{document.getElementById('m-ask').classList.remove('show');cb();};
  document.getElementById('m-ask').classList.add('show');
}
function askInput(title,msg,val,type,cb){
  document.getElementById('ask-title').textContent=title;
  document.getElementById('ask-msg').textContent=msg||'';
  const inp=document.getElementById('ask-input');
  inp.style.display='block';inp.type=type||'text';inp.value=val??'';
  document.getElementById('ask-ok').onclick=()=>{document.getElementById('m-ask').classList.remove('show');cb(inp.value);};
  document.getElementById('m-ask').classList.add('show');
  setTimeout(()=>{try{inp.focus();}catch(e){}},250);
}

/* ═══ DAY TAP ═══ */
function onDay(y,m,d){
  haptic();
  const st=state(y,m,d),k=st.k;
  if(picked){
    if(picked===k){cancelPick();return;}
    if(st.work){toast('Tocca un giorno di riposo (bianco)');return;}
    if(st.hol){toast('Non puoi lavorare in una festività');return;}
    if(st.cls!=='rest'){toast('Questo giorno è già modificato');return;}
    if(!sameWeek(picked,k)){toast('⚠️ Deve essere nella stessa settimana (Dom→Sab)');return;}
    const fromPolicy=switchPolicy(picked),toPolicy=switchPolicy(k);
    if(!fromPolicy.allowed){toast(fromPolicy.reason);return;}
    if(!toPolicy.allowed){toast(toPolicy.reason);return;}
    const pairPolicy=switchPairPolicy(picked,k);
    if(!pairPolicy.allowed){toast(pairPolicy.reason);return;}
    snapshot();
    const sw={from:picked,to:k};
    M.switches.push(sw);
    picked=null;
    document.getElementById('guide').classList.remove('show');
    commit('✓ Spostamento confermato');
    shareSwitch(sw);
    return;
  }
  openSheet(k);
}

function weekStripHTML(k){
  const ws=weekStart(fromKey(k));let h='';
  for(let i=0;i<7;i++){
    const t=addDays(ws,i);
    const tk=keyOf(t);
    const s=stateK(tk);
    const isCur=tk===k;
    const wc=WK_CLS[s.cls]||'';
    h+=`<div class="wk-c ${wc}${isCur?' cur':''}"><div class="n">${DN[i]}</div><div class="d">${t.getDate()}</div></div>`;
  }
  return h;
}

function openSheet(k){
  sheetKey=k;const st=stateK(k);
  document.getElementById('sd-title').textContent=fmt(k);
  let sub=st.lbl;
  if(st.work)sub+=` · ${tStr(k)} (${durH(k).toFixed(1)}h)`;
  if(st.hol&&!sub.startsWith(st.hol))sub=`${st.hol} · `+sub;
  document.getElementById('sd-sub').textContent=sub;
  document.getElementById('sd-week').innerHTML=weekStripHTML(k);
  const A=document.getElementById('sd-acts');A.innerHTML='';

  const add=(ico,tx,sm,fn,cls='')=>{
    const b=document.createElement('button');b.className='s-act '+cls;
    b.innerHTML=`<span class="ic">${ico}</span><span>${esc(tx)}${sm?`<small>${esc(sm)}</small>`:''}</span>`;
    b.onclick=fn;A.appendChild(b);
  };

  const sw=M.switches.find(s=>s.from===k||s.to===k);
  if(sw){
    add('📤','Condividi richiesta switch',`Week ${weekNumber(sw.from)}`,()=>{closeSheet();shareSwitch(sw);},'primary');
    add('↩️','Annulla spostamento',`${fmt(sw.from)} ↔ ${fmt(sw.to)}`,()=>{
      snapshot();M.switches=M.switches.filter(s=>s!==sw);done('Spostamento annullato');});
    if(sw.to===k){ // orario modificabile solo sul giorno di destinazione
      if(!M.special[k])add('⏰','Orario diverso',tStr(k),()=>specialEditor(A,k));
      else add('↩️','Rimuovi orario speciale',null,()=>{snapshot();delete M.special[k];done('Orario standard');});
    }
  }
  else if(st.work){
    if(!M.special[k]&&st.cls==='work')
      add('🔄','Sposta questo turno','scegli dove spostarlo nella stessa settimana',()=>startPick(k),'primary');
    if(M.special[k])add('⏰','Modifica orario',tStr(k),()=>specialEditor(A,k),'primary');
    else add('⏰','Orario diverso oggi','il manager ti ha comunicato un orario diverso',()=>specialEditor(A,k));
    if(M.special[k]&&!st.bw)
      add('↩️','Rimuovi questo turno extra',null,()=>{snapshot();delete M.special[k];done('Turno rimosso');});
    else if(M.special[k])
      add('↩️','Torna all\'orario standard',null,()=>{snapshot();delete M.special[k];done('Orario standard');});
  }
  else{
    add('➕','Lavoro qui','turno extra in questo giorno di riposo',()=>specialEditor(A,k,true));
  }
  document.getElementById('m-day').classList.add('show');
}

function specialEditor(A,k,isNew=false){
  A.innerHTML='';
  const init=isNew?[{...M.defTime}]:(M.special[k]&&M.special[k].length?M.special[k]:[{...M.defTime}]);
  let cur=init.map(t=>({...t}));
  const wrap=document.createElement('div');
  function readInputs(){
    wrap.querySelectorAll('input[type=time]').forEach(inp=>{
      const i=+inp.getAttribute('data-i'),f=inp.getAttribute('data-f');
      if(cur[i]&&inp.value)cur[i][f]=inp.value;
    });
  }
  function draw(){
    wrap.innerHTML='';
    cur.forEach((t,i)=>{
      const r=document.createElement('div');r.className='shift-row';
      const f1=document.createElement('div');f1.className='pat-f';
      f1.innerHTML=`<label>Turno ${i+1} · entrata</label>`;
      const i1=document.createElement('input');i1.type='time';i1.value=t.s;i1.setAttribute('data-i',i);i1.setAttribute('data-f','s');
      f1.appendChild(i1);
      const f2=document.createElement('div');f2.className='pat-f';
      f2.innerHTML=`<label>uscita</label>`;
      const i2=document.createElement('input');i2.type='time';i2.value=t.e;i2.setAttribute('data-i',i);i2.setAttribute('data-f','e');
      f2.appendChild(i2);
      r.appendChild(f1);r.appendChild(f2);
      if(cur.length>1){
        const rm=document.createElement('button');rm.className='rm-btn';rm.textContent='🗑';
        rm.onclick=()=>{readInputs();cur.splice(i,1);draw();};
        r.appendChild(rm);
      }
      wrap.appendChild(r);
    });
    const addB=document.createElement('button');addB.className='add-shift-btn';
    addB.textContent='＋ Aggiungi 2° ingresso (doppio turno)';
    addB.onclick=()=>{readInputs();cur.push({s:'22:00',e:'06:00'});draw();};
    wrap.appendChild(addB);
    const saveB=document.createElement('button');saveB.className='mbtn';saveB.textContent='💾 Salva';
    saveB.onclick=()=>{
      readInputs();
      if(!cur.every(t=>t.s&&t.e)){toast('Inserisci tutti gli orari');return;}
      snapshot();M.special[k]=cur.map(t=>({...t}));
      done(`✏️ Orario ${cur.length>1?'doppio ':''}salvato`);
    };
    wrap.appendChild(saveB);
  }
  draw();A.appendChild(wrap);
}

function done(msg){closeSheet();commit(msg);}
function closeSheet(){document.getElementById('m-day').classList.remove('show');sheetKey=null;}
let daySheetStartY=null;
let daySheetDragY=0;
const daySheet=document.querySelector('#m-day .sheet');
daySheet.addEventListener('touchstart',e=>{
  if(daySheet.scrollTop>0||e.target.closest('button,input,textarea'))return;
  daySheetStartY=e.touches[0].clientY;daySheetDragY=0;
},{passive:true});
daySheet.addEventListener('touchmove',e=>{
  if(daySheetStartY===null)return;
  daySheetDragY=Math.max(0,e.touches[0].clientY-daySheetStartY);
  if(daySheetDragY>0){daySheet.style.transform=`translateY(${daySheetDragY}px)`;e.preventDefault();}
},{passive:false});
daySheet.addEventListener('touchend',()=>{
  const close=daySheetDragY>70;
  daySheet.style.transform='';daySheetStartY=null;daySheetDragY=0;
  if(close)closeSheet();
},{passive:true});
function startPick(k){
  const policy=switchPolicy(k);
  if(!policy.allowed){closeSheet();toast(policy.reason);return;}
  picked=k;closeSheet();
  document.getElementById('guide-tx').innerHTML=`Sposta turno <b>${fmt(k)}</b> → scegli un riposo nella stessa settimana (entro Week ${weekNumber(switchMaxWeekKey())}; esclusi festivi, pre/post festivi e sequenze di 6 giorni)`;
  document.getElementById('guide').classList.add('show');render();
}
function cancelPick(){picked=null;document.getElementById('guide').classList.remove('show');render();}

/* ═══ NAVIGAZIONE ═══ */
function setView(v){
  const returningToCalendar=v==='cal'&&view!=='cal';
  view=v;
  document.querySelectorAll('.nbtn').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.getElementById('v-cal').style.display=v==='cal'?'block':'none';
  document.getElementById('v-ana').classList.toggle('show',v==='ana');
  document.getElementById('v-info').classList.toggle('show',v==='info');
  if(v==='ana')renderAnalysis();
  renderLiveStrip();
  updateLiveStripVisibility();
  if(returningToCalendar)requestAnimationFrame(openAtCurrentMonth);
}
function goToday(){
  haptic();
  if(view!=='cal')setView('cal');
  const now=liveNow();
  const y=now.getFullYear(),m=now.getMonth()+1;
  ensureRenderedYear(y);curYear=y;updateYearControls();updateYearNote();
  const locate=(attempt=0)=>{
    const month=document.getElementById(`mn-${y}-${m}`);
    const today=document.querySelector('.dc.today');
    if(!month||!today)return;
    const header=calendarViewportTop();
    const monthRect=month.getBoundingClientRect();
    if(attempt===0){window.scrollTo({top:Math.max(0,window.scrollY+monthRect.top-header-8),behavior:'smooth'});setTimeout(()=>locate(1),350);return;}
    const rect=today.getBoundingClientRect(),visibleMonth=month.getBoundingClientRect();
    if((visibleMonth.top<header+4||rect.top<header+8||rect.bottom>window.innerHeight-16)&&attempt<24){setTimeout(()=>locate(attempt+1),100);return;}
    today.classList.remove('locate');
    void today.offsetWidth;
    today.classList.add('locate');
    setTimeout(()=>today.classList.remove('locate'),2300);
  };
  locate();
}
function openAtCurrentMonth(){
  const now=liveNow(),y=now.getFullYear(),m=now.getMonth()+1;
  curYear=y;ensureRenderedYear(y);updateYearControls();updateYearNote();
  const el=document.getElementById(`mn-${y}-${m}`);
  if(!el)return;
  const headerHeight=calendarViewportTop();
  const top=window.scrollY+el.getBoundingClientRect().top-headerHeight-8;
  const root=document.documentElement,previous=root.style.scrollBehavior;
  root.style.scrollBehavior='auto';
  window.scrollTo(0,Math.max(0,top));
  requestAnimationFrame(()=>{root.style.scrollBehavior=previous;updateLiveStripVisibility();});
}
function scheduleOpenAtCurrentMonth(){
  requestAnimationFrame(()=>requestAnimationFrame(openAtCurrentMonth));
  [80,220].forEach(delay=>setTimeout(openAtCurrentMonth,delay));
}
function calendarViewportTop(){
  const hdr=document.querySelector('.hdr');
  let top=hdr?hdr.getBoundingClientRect().height:0;
  if(window.matchMedia('(min-width:900px)').matches){
    const live=document.getElementById('desktop-live-strip');
    if(live)top+=live.getBoundingClientRect().height+10;
  }
  return top;
}
function applyTheme(n){
  document.documentElement.dataset.theme=n;
  const tb=document.getElementById('theme-btn');
  if(tb)tb.textContent=n==='dark'?'☀️':'🌙';
  const dt=document.getElementById('dark-toggle');
  if(dt)dt.classList.toggle('on',n==='dark');
  const mt=document.getElementById('meta-theme');
  if(mt)mt.content=n==='dark'?'#0a1120':'#eaeef4';
}
function applyThemePreference(){
  applyTheme('light');
  if(CAN_STORE)try{localStorage.removeItem('bb104theme');localStorage.removeItem('bb104themeuntil');}catch(e){}
}
function toggleTheme(){
  haptic();
  const n=document.documentElement.dataset.theme==='dark'?'light':'dark';
  applyTheme(n);
}

/* ═══ RENDER ═══ */
function render(){
  invalidate();
  const todayK=liveTodayKey();
  const cal=document.getElementById('cal');
  let anchor=null;
  if(cal.children.length){
    const hdrBottom=document.querySelector('.hdr').getBoundingClientRect().bottom;
    const months=[...cal.querySelectorAll('.month')];
    const visible=months.find(el=>el.getBoundingClientRect().bottom>hdrBottom+4);
    if(visible)anchor={id:visible.id,top:visible.getBoundingClientRect().top};
  }
  cal.innerHTML='';
  for(let y=minRenderedYear;y<=maxRenderedYear;y++)cal.insertAdjacentHTML('beforeend',yearHTML(y,todayK));
  if(anchor){
    requestAnimationFrame(()=>{const el=document.getElementById(anchor.id);if(el)window.scrollBy(0,el.getBoundingClientRect().top-anchor.top);});
  }

  updateYearControls();

  renderTodayCard();
  renderLiveStrip();
  renderStrip();
  requestAnimationFrame(updateLiveStripVisibility);

  updateYearNote();
}

function targetDays(){
  const tgts=new Set();
  if(picked){const ws=weekStart(fromKey(picked));
    for(let i=0;i<7;i++){
      const tk=keyOf(addDays(ws,i));
      if(tk!==picked&&stateK(tk).cls==='rest'&&switchPolicy(tk).allowed&&switchPairPolicy(picked,tk).allowed)tgts.add(tk);}}
  return tgts;
}

function yearHTML(y,todayK=liveTodayKey()){
  ensureHolidayYear(y);
  const tgts=targetDays();
  let out=`<section class="year-block" id="yr-${y}" data-year="${y}"><div class="year-title">${y}</div><div class="year-grid">`;
  for(let m=1;m<=12;m++){
    const fd=new Date(y,m-1,1),ld=new Date(y,m,0).getDate(),dow=fd.getDay();
    let mT=0;
    let html=`<div class="month" id="mn-${y}-${m}" data-year="${y}" data-month="${m}"><div class="m-head">
      <div class="m-name" onclick="openMonth(${y},${m})">${MN[m-1]}</div>
      <div class="m-ct">`;
    for(let d=1;d<=ld;d++)if(state(y,m,d).work)mT++;
    html+=`${mT} turni</div></div><div class="dnames">`;
    DN.forEach(n=>html+=`<div class="dn">${n}</div>`);
    html+=`</div><div class="dgrid">`;
    for(let i=0;i<dow;i++)html+=`<div class="dc empty"></div>`;
    for(let d=1;d<=ld;d++){
      const st=state(y,m,d);
      let c='dc '+st.cls;
      if(st.k===todayK)c+=' today';
      if(picked===st.k)c+=' picked';
      if(tgts.has(st.k))c+=' target';
      const nb='';
      if(st.cls==='double'&&st.spec&&st.spec.length>1){
        const t2=st.spec[1];
        html+=`<div class="${c}" data-date="${st.k}" onclick="onDay(${y},${m},${d})"><div class="dn-num">${d}${nb}</div><div class="dn-sh2">${esc(t2.s)}</div></div>`;
      } else html+=`<div class="${c}" data-date="${st.k}" onclick="onDay(${y},${m},${d})">${d}${nb}</div>`;
    }
    out+=html+`</div></div>`;
  }
  return out+`</div></section>`;
}

function updateYearControls(){
  const yp=document.getElementById('ypills');yp.innerHTML='';
  const yearButton=(text,label,fn,active=false,disabled=false)=>{const b=document.createElement('button');b.className='yp'+(active?' on':'');b.textContent=text;b.setAttribute('aria-label',label);b.onclick=fn;b.disabled=disabled;yp.appendChild(b);};
  yearButton('‹','Vai all anno precedente',()=>{haptic();jumpToYear(curYear-1);},false,curYear<=MIN_YEAR);
  yearButton(curYear,`Vai a gennaio ${curYear}`,()=>jumpToYear(curYear),true);
  yearButton('›','Vai all anno successivo',()=>{haptic();jumpToYear(curYear+1);});
}

function updateYearNote(){document.getElementById('note27').textContent=curYear>_cy?`⚠️ ${curYear}: proiezione — schema confermato entro novembre ${curYear-1}.`:'';}

function ensureRenderedYear(y){
  y=Math.max(MIN_YEAR,y);
  const cal=document.getElementById('cal');
  if(!cal.children.length){minRenderedYear=Math.max(MIN_YEAR,y-1);maxRenderedYear=Math.max(y+1,minRenderedYear+2);render();return;}
  if(y<minRenderedYear-4||y>maxRenderedYear+4){minRenderedYear=Math.max(MIN_YEAR,y-1);maxRenderedYear=Math.max(y+1,minRenderedYear+2);render();return;}
  while(y<minRenderedYear&&minRenderedYear>MIN_YEAR){minRenderedYear--;cal.insertAdjacentHTML('afterbegin',yearHTML(minRenderedYear));}
  while(y>maxRenderedYear){maxRenderedYear++;cal.insertAdjacentHTML('beforeend',yearHTML(maxRenderedYear));}
}

function jumpToYear(y,m=1,block='start'){
  y=Math.max(MIN_YEAR,y);
  ensureHolidayYear(y);ensureRenderedYear(y);curYear=y;updateYearControls();updateYearNote();
  requestAnimationFrame(()=>{const el=document.getElementById(`mn-${y}-${m}`)||document.getElementById(`yr-${y}`);if(el&&el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block});});
}

function extendCalendar(){
  if(calendarExtending||view!=='cal')return;
  calendarExtending=true;
  requestAnimationFrame(()=>{
    const cal=document.getElementById('cal');
    if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-1200){maxRenderedYear++;cal.insertAdjacentHTML('beforeend',yearHTML(maxRenderedYear));}
    if(window.scrollY<500&&minRenderedYear>MIN_YEAR){const oldH=document.documentElement.scrollHeight;minRenderedYear--;cal.insertAdjacentHTML('afterbegin',yearHTML(minRenderedYear));window.scrollBy(0,document.documentElement.scrollHeight-oldH);}
    calendarExtending=false;
  });
}

function updateVisibleYear(){
  if(view!=='cal')return;
  const hdrBottom=document.querySelector('.hdr').getBoundingClientRect().bottom;
  const months=[...document.querySelectorAll('.month')];
  let best=null,bestDist=Infinity;
  months.forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom<=hdrBottom)return;const dist=Math.abs(r.top-hdrBottom);if(dist<bestDist){best=el;bestDist=dist;}});
  if(best){const y=+best.dataset.year;if(y!==curYear){curYear=y;updateYearControls();updateYearNote();}}
}

function renderTodayCard(){
  const tc=document.getElementById('tc');
  if(!tc)return;
  const now=liveNow();
  const tk=liveTodayKey();
  const st=stateK(tk);
  const dateStr=`${DF[now.getDay()]} ${now.getDate()} ${MN[now.getMonth()]} ${now.getFullYear()}`;
  const ongoing=findOngoing();

  // turno in corso iniziato IERI (22:00→06:00) su un oggi non lavorativo
  if(ongoing&&ongoing.k!==tk&&!st.work){
    const t=ongoing.shift;
    const nxt=getNextShiftStart();
    const next=nxt?`<div class="tc-next">Prossimo turno: <b>${fmt(nxt.k)} · ${esc(nxt.shift.s)}</b></div>`:'';
    tc.className='tc';
    tc.innerHTML=`<div class="tc-date">Oggi · ${dateStr}</div>
      <div class="tc-shifts"><div class="tc-shift"><img class="tc-status-icon" src="turno-lavoro.png" alt=""><div class="tc-t">${esc(t.s)} → ${esc(t.e)}</div><div class="tc-sub">iniziato ieri</div></div></div>
      <div class="tc-badges"><span class="tc-badge ongoing">In turno · finisce ${fmtCountdown(ongoing.end-now)||'presto'}</span></div>${next}
      `;
    return;
  }

  if(st.work){
    const shifts=shiftsOf(tk);
    const isDouble=shifts.length>1;
    const rem=remainingShiftsMonth();
    let shiftsHTML=shifts.map((t,i)=>`
      <div class="tc-shift">
        <img class="tc-status-icon" src="turno-lavoro.png" alt="">
        <div class="tc-t">${esc(t.s)} → ${esc(t.e)}</div>
        <div class="tc-sub">${calcDurH(t).toFixed(1)}h</div>
      </div>`).join('');

    let badges='<div class="tc-badges">';
    if(ongoing){
      badges+=`<span class="tc-badge ongoing">In turno · finisce ${fmtCountdown(ongoing.end-now)||'presto'}</span>`;
    } else {
      const nxt=getNextShiftStart();
      if(nxt&&nxt.k===tk){
        const cd=fmtCountdownDate(nxt.start);
        if(cd){
          const isSoon=nxt.start-now<3600000;
          badges+=`<span class="tc-badge ${isSoon?'soon':'cd'}">⏰ ${cd}</span>`;
        }
      }
    }
    if(rem>0)badges+=`<span class="tc-badge rem">${rem} turni restanti nel mese</span>`;
    badges+='</div>';
    if(isDouble)badges+=`<div class="tc-total">⚡ Doppio turno · ${durH(tk).toFixed(1)}h totali</div>`;
    if(st.hol)badges+=`<div class="tc-next" style="margin-top:5px">🎉 ${esc(st.hol)}</div>`;

    tc.className='tc';
    tc.innerHTML=`<div class="tc-date">Oggi · ${dateStr}</div><div class="tc-shifts">${shiftsHTML}</div>${badges}
      <div class="tc-actions"><button class="tc-btn" onclick="openSheet('${tk}')">✏️ Modifica</button></div>`;
  } else {
    const nxt=getNextShiftStart();
    let sub=st.cls==='hol'?`🎉 ${esc(st.hol)} · Giorno libero`:esc(st.lbl||'Giorno libero');
    let next='',cd='';
    if(nxt){
      const cdStr=fmtCountdownDate(nxt.start);
      next=`<div class="tc-next">Prossimo turno: <b>${fmt(nxt.k)} · ${esc(nxt.shift.s)}</b></div>`;
      if(cdStr){
        const isSoon=nxt.start-now<3600000;
        cd=`<div class="tc-badges"><span class="tc-badge ${isSoon?'soon':'cd'}">⏰ ${cdStr}</span></div>`;
      }
    }
    tc.className='tc off';
    tc.innerHTML=`<div class="tc-date">Oggi · ${dateStr}</div><div class="tc-shifts"><div class="tc-off"><img class="tc-status-icon" src="turno-riposo.png" alt=""><span>${sub}</span></div></div>${next}${cd}`;
  }
}

function renderLiveStrip(){
  const strips=[document.getElementById('live-strip'),document.getElementById('desktop-live-strip')].filter(Boolean);
  if(!strips.length)return;
  if(view!=='cal'){strips.forEach(strip=>strip.hidden=true);return;}
  strips.forEach(strip=>strip.hidden=false);
  const now=liveNow();
  const tk=liveTodayKey();
  const st=stateK(tk);
  const ongoing=findOngoing();
  let html='';
  if(ongoing){
    const t=ongoing.shift;
    html=`<img class="live-art" src="turno-lavoro.png" alt=""><span class="live-now work">In turno</span><span class="live-next"><b>Fino alle ${esc(t.e)}</b></span><span class="live-count">${fmtCountdown(ongoing.end-now)||'presto'}</span>`;
  }else{
    const nxt=getNextShiftStart();
    if(!nxt)html=`<img class="live-art" src="${st.work?'turno-lavoro.png':'turno-riposo.png'}" alt=""><span class="live-now ${st.work?'work':'rest'}">${st.work?'Oggi lavori':'Riposo oggi'}</span>`;
    else{
      const count=fmtCountdownDate(nxt.start)||'';
      const tomorrow=keyOf(addDays(now,1));
      const isNightStart=nxt.k===tomorrow&&nxt.start.getHours()<7;
      if(!st.work&&isNightStart)html=`<img class="live-art" src="turno-riposo.png" alt=""><span class="live-now rest">Riposo oggi</span><span class="live-next"><b>Stanotte lavori</b> · ${esc(nxt.shift.s)}–${esc(nxt.shift.e)}</span><span class="live-count">${esc(count)}</span>`;
      else{
        const nowLabel=st.work?'Oggi lavori':'Riposo oggi';
        const nextLabel=nxt.k===tk?'Oggi':fmt(nxt.k);
        html=`<img class="live-art" src="${st.work?'turno-lavoro.png':'turno-riposo.png'}" alt=""><span class="live-now ${st.work?'work':'rest'}">${esc(nowLabel)}</span><span class="live-next"><b>Prossimo turno</b> · ${esc(nextLabel)} ${esc(nxt.shift.s)}–${esc(nxt.shift.e)}</span><span class="live-count">${esc(count)}</span>`;
      }
    }
  }
  strips.forEach(strip=>strip.innerHTML=html);
}

function renderStrip(){
  const strip=document.getElementById('strip');
  if(!strip)return;
  const now=liveNow();
  strip.innerHTML='';
  for(let i=0;i<14;i++){
    const dt=addDays(now,i);
    const st=state(dt.getFullYear(),dt.getMonth()+1,dt.getDate());
    let cls='sday',stx='Libero';
    if(st.cls==='double'&&st.spec&&st.spec.length>1){cls+=' double';stx=st.spec[0].s;}
    else if(st.cls==='wh'){cls+=' wh';stx='Festivo';}
    else if(st.cls==='hol'){cls+=' hol';stx=(st.hol||'').substr(0,7);}
    else if(st.cls==='extra'){cls+=' extra';stx=shiftsOf(st.k)[0].s;}
    else if(st.work){cls+=' work';stx=st.cls==='special'?shiftsOf(st.k)[0].s:'Turno';}
    else cls+=' off';
    if(i===0)cls+=' today';
    strip.insertAdjacentHTML('beforeend',`<div class="${cls}" onclick="onDay(${dt.getFullYear()},${dt.getMonth()+1},${dt.getDate()})"><div class="sd-n">${DF[dt.getDay()]}</div><div class="sd-d">${dt.getDate()}</div><div class="sd-s">${esc(stx)}</div></div>`);
  }
}

function renderAll(){
  render();
  renderPatSelect();
  if(view==='ana')renderAnalysis();
}

/* ═══ RIEPILOGO ═══ */
function renderAnalysis(){
  const now=liveNow(),m=now.getMonth()+1,y=now.getFullYear();
  let oreM=0,turniM=0;
  const ld=new Date(y,m,0).getDate();
  for(let d=1;d<=ld;d++){const st=state(y,m,d);if(st.work){turniM++;oreM+=durH(st.k);}}
  let turniY=0,oreY=0;
  for(let mm=1;mm<=12;mm++){
    const ldy=new Date(y,mm,0).getDate();
    for(let d=1;d<=ldy;d++){
      const st=state(y,mm,d);
      if(!st.work)continue;
      turniY++;oreY+=durH(st.k);
    }
  }

  document.getElementById('mese-label').textContent=MN[m-1];
  document.getElementById('ore-row').innerHTML=`
    <div class="ore-c"><b>${turniM}</b><span>turni ${MS[m-1]}</span></div>
    <div class="ore-c"><b>${oreM.toFixed(0)}h</b><span>ore ${MS[m-1]}</span></div>
    <div class="ore-c"><b>${turniY}</b><span>turni ${y}</span></div>
    <div class="ore-c"><b>${oreY.toFixed(0)}h</b><span>ore ${y}</span></div>`;

  // riposi lunghi: iterazione su date di calendario (immune ai cambi ora)
  const rbEl=document.getElementById('restblocks');rbEl.innerHTML='';
  const blocks=[];
  let cur=new Date(now.getFullYear(),now.getMonth(),now.getDate()),run=0,rs=null;
  for(let i=0;i<300;i++){
    if(!state(cur.getFullYear(),cur.getMonth()+1,cur.getDate()).work){if(run===0)rs=new Date(cur);run++;}
    else{if(run>=4)blocks.push({s:rs,len:run});run=0;}
    cur=addDays(cur,1);
  }
  if(run>=4)blocks.push({s:rs,len:run});
  if(!blocks.length){rbEl.innerHTML='<div style="font-size:.72em;color:var(--soft);padding:12px 0;text-align:center">Nessun blocco ≥4 giorni in vista</div>';return;}
  const mx=Math.max(...blocks.map(b=>b.len),1);
  blocks.slice(0,7).forEach(b=>{
    const e=addDays(b.s,b.len-1);
    rbEl.insertAdjacentHTML('beforeend',`<div class="rb-item">
      <div class="rb-days">${b.len}</div>
      <div class="rb-tx"><div class="rb-t1">${b.s.getDate()} ${MS[b.s.getMonth()]} → ${e.getDate()} ${MS[e.getMonth()]}</div>
      <div class="rb-t2">giorni consecutivi liberi</div>
      <div class="rb-bar" style="width:${Math.round(b.len/mx*100)}%"></div></div></div>`);});
}

/* ═══ SELETTORE PATTERN (solo preset pubblicati) ═══ */
function renderPatSelect(){
  const sel=document.getElementById('pat-select');
  if(!sel)return;
  const names=Object.keys(PATTERNS);
  sel.innerHTML=names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
  sel.value=M.patternId;
}
function switchPattern(name){
  if(!PATTERNS[name]||name===M.patternId){renderPatSelect();return;}
  snapshot();
  M.patternId=name;
  commit('Pattern '+name);
}
/* ═══ MESE DETTAGLIO ═══ */
function openMonth(y,m){
  haptic();
  document.getElementById('mf-title').textContent=MN[m-1]+' '+y;
  const colors={work:'var(--blue)',wh:'var(--blue)',hol:'var(--hol)',extra:'var(--extra)',special:'var(--blue)',double:'var(--blue)',swout:'var(--swout)',swin:'var(--blue)',rest:'var(--faint)'};
  const ld=new Date(y,m,0).getDate();let h='';
  for(let d=1;d<=ld;d++){
    const st=state(y,m,d);
    const tm=st.work?` · ${esc(tStr(st.k))}`:'';
    h+=`<div class="mf-day"><div class="mf-num">${d}</div><div class="mf-dname">${DF[st.dt.getDay()]}</div><div class="mf-dot" style="background:${colors[st.cls]||'var(--faint)'}"></div><div class="mf-lbl">${esc(st.lbl)}${tm}</div></div>`;
  }
  document.getElementById('mf-body').innerHTML=h;
  document.getElementById('m-month').classList.add('show');
}
/* ═══ SWIPE ANNI ═══ */
let tx0=null,ty0=null;
document.addEventListener('touchstart',e=>{
  if(!picked){tx0=e.touches[0].clientX;ty0=e.touches[0].clientY;}
},{passive:true});
document.addEventListener('touchend',e=>{
  if(tx0===null)return;
  const dx=e.changedTouches[0].clientX-tx0;
  const dy=e.changedTouches[0].clientY-ty0;
  tx0=null;ty0=null;
  if(Math.abs(dy)>Math.abs(dx)*1.2)return;
  if(Math.abs(dx)<60)return;
  if(view==='cal'&&!document.getElementById('m-day').classList.contains('show')){
    haptic();jumpToYear(curYear+(dx<0?1:-1));
  }
},{passive:true});

/* ═══ TASTIERA ═══ */
document.addEventListener('keydown',e=>{
  const tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(e.key==='Escape'){
    if(document.getElementById('m-day').classList.contains('show')){closeSheet();return;}
    if(document.getElementById('m-ask').classList.contains('show')){document.getElementById('m-ask').classList.remove('show');return;}
    if(document.getElementById('m-switch').classList.contains('show')){closeSwitchMessage();return;}
    if(document.getElementById('m-copied').classList.contains('show')){closeCopyConfirmation();return;}
    if(document.getElementById('m-month').classList.contains('show')){document.getElementById('m-month').classList.remove('show');return;}
    if(picked){cancelPick();return;}
  }
  if(view==='cal'&&!document.getElementById('m-day').classList.contains('show')){
    if(e.key==='ArrowRight')jumpToYear(curYear+1);
    if(e.key==='ArrowLeft')jumpToYear(curYear-1);
  }
});

/* ═══ TOAST ═══ */
let tt;
function toast(m){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=m;t.classList.add('show');clearTimeout(tt);
  const duration=/⚠️|errore|non valido|impossibile|negato/i.test(m)?6000:4000;
  tt=setTimeout(()=>t.classList.remove('show'),duration);
}

/* ═══ INIT ═══ */
load();
if(!CAN_STORE)document.getElementById('store-warn').style.display='block';

// ogni apertura parte in tema chiaro; il cambio manuale vale per la sessione corrente
applyThemePreference();

const nowInit=liveNow();
curYear=Math.max(MIN_YEAR,nowInit.getFullYear());ensureHolidayYear(curYear);
minRenderedYear=Math.max(MIN_YEAR,curYear-1);maxRenderedYear=Math.max(curYear+1,minRenderedYear+2);
lastDayKey=liveTodayKey();
invalidate();
if('scrollRestoration' in history)history.scrollRestoration='manual';
render();
renderPatSelect();
startLiveTimer();
setupPWA();

// apertura sempre sul mese corrente, anche dopo un ripristino tardivo dello scroll del browser
scheduleOpenAtCurrentMonth();
window.addEventListener('pageshow',scheduleOpenAtCurrentMonth);

setTimeout(()=>toast('👆 Per gestire un turno, tocca un giorno nel Calendario.'),900);
