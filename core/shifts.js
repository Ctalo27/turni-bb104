/* ═══ CACHE STATI ═══ */
let _sc={},_swFrom=new Set(),_swTo=new Set();
function invalidate(){
  _sc={};
  _swFrom=new Set(M.switches.map(s=>s.from));
  _swTo=new Set(M.switches.map(s=>s.to));
}

/* ═══ MOTORE TURNI: pure functions, nessun accesso al DOM ═══ */
function anchorDate(){const p=PATTERN_ANCHOR.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function baseWork(dt){
  const diff=Math.round((dt-anchorDate())/864e5);
  const pattern=patternFor(M.patternId);
  if(diff<0||!pattern.length)return false;
  return pattern[Math.floor(diff/7)%pattern.length][dt.getDay()]===1;
}
function isHol(k){ensureHolidayYear(+k.split('-')[0]);return !!HOLS[k];}
function getHolName(k){return natHolName(k)||'Festività';}

function shiftsOf(k){
  if(M.special[k]&&M.special[k].length)return M.special[k];
  return [{...M.defTime}];
}
function calcDurH(t){
  const[s1,s2]=t.s.split(':').map(Number),[e1,e2]=t.e.split(':').map(Number);
  let h=(e1+e2/60)-(s1+s2/60);if(h<=0)h+=24;return h;
}
function durH(k){return shiftsOf(k).reduce((tot,t)=>tot+calcDurH(t),0);}
function tStr(k){return shiftsOf(k).map(t=>`${t.s}→${t.e}`).join(' + ');}

function state(y,m,d){
  const k=key(y,m,d);
  if(_sc[k])return _sc[k];
  const dt=new Date(y,m-1,d),hol=isHol(k)?getHolName(k):null;
  const spec=M.special[k]&&M.special[k].length?M.special[k]:null;
  const isDouble=!!spec&&spec.length>1;
  const bw=baseWork(dt);
  let r;
  if(_swFrom.has(k))r={cls:'swout',work:false,k,dt,hol,lbl:'Liberato',spec:null,bw};
  else if(_swTo.has(k))r={cls:isDouble?'double':'swin',work:true,k,dt,hol,lbl:'Turno spostato',spec,bw};
  else if(spec){
    if(isDouble)r={cls:'double',work:true,k,dt,hol,lbl:'Doppio turno',spec,bw};
    else if(bw)r={cls:'special',work:true,k,dt,hol,lbl:'Orario speciale',spec,bw};
    else r={cls:'extra',work:true,k,dt,hol,lbl:'Turno extra',spec,bw};
  }
  else if(hol&&bw)r={cls:'wh',work:false,k,dt,hol,lbl:hol+' · turno previsto, non lavori',spec:null,bw:true};
  else if(hol)r={cls:'hol',work:false,k,dt,hol,lbl:hol,spec:null,bw};
  else if(bw)r={cls:'work',work:true,k,dt,hol,lbl:'Turno',spec:null,bw};
  else r={cls:'rest',work:false,k,dt,hol,lbl:'Riposo',spec:null,bw};
  _sc[k]=r;return r;
}
function stateK(k){const d=fromKey(k);return state(d.getFullYear(),d.getMonth()+1,d.getDate());}

/* ═══ POLICY SWITCH ═══ */
function isPPHol(k){
  const dt=fromKey(k);
  return isHol(keyOf(addDays(dt,-1)))||isHol(keyOf(addDays(dt,1)));
}
const SWITCH_MAX_FUTURE_WEEKS=8;
function switchMaxWeekKey(referenceK=liveTodayKey()){
  return keyOf(addDays(isoWeekMonday(referenceK),SWITCH_MAX_FUTURE_WEEKS*7));
}
function switchPolicy(k,referenceK=liveTodayKey()){
  if(fromKey(k)<fromKey(referenceK))return {allowed:false,reason:`⚠️ Switch non consentito il ${fmt(k)}: è un giorno già passato.`};
  if(isHol(k))return {allowed:false,reason:`⚠️ Switch non consentito il ${fmt(k)}: ${getHolName(k)} è festivo.`};
  if(isPPHol(k))return {allowed:false,reason:`⚠️ Switch non consentito il ${fmt(k)}: è giorno pre/post festivo.`};
  const weeksAway=Math.round((isoWeekMonday(k)-isoWeekMonday(referenceK))/(7*864e5));
  if(weeksAway>SWITCH_MAX_FUTURE_WEEKS)return {allowed:false,reason:`⚠️ Puoi richiedere switch al massimo fino alla Week ${weekNumber(switchMaxWeekKey(referenceK))}.`};
  return {allowed:true,reason:''};
}
function projectedWorkStreak(fromK,toK,workResolver=k=>stateK(k).work){
  const works=k=>k===fromK?false:(k===toK?true:workResolver(k));
  const center=fromKey(toK);
  let count=1;
  for(let i=1;i<=31;i++){if(!works(keyOf(addDays(center,-i))))break;count++;}
  for(let i=1;i<=31;i++){if(!works(keyOf(addDays(center,i))))break;count++;}
  return count;
}
function switchPairPolicy(fromK,toK,workResolver){
  const streak=projectedWorkStreak(fromK,toK,workResolver);
  if(streak>=6)return {allowed:false,reason:`⚠️ Switch non consentito: creerebbe ${streak} giorni consecutivi di lavoro.`};
  return {allowed:true,reason:'',streak};
}
