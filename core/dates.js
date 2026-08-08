/* ═══ HELPERS DATA/FORMATO ═══ */
function key(y,m,d){return `${y}-${m}-${d}`;}
function fromKey(k){const p=k.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function keyOf(dt){return key(dt.getFullYear(),dt.getMonth()+1,dt.getDate());}
function addDays(dt,n){return new Date(dt.getFullYear(),dt.getMonth(),dt.getDate()+n);}
function fmt(k){const d=fromKey(k);return `${DF[d.getDay()]} ${d.getDate()} ${MS[d.getMonth()]}`;}
function liveNow(){return new Date();}
function liveTodayKey(){return keyOf(new Date());}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad2=n=>String(n).padStart(2,'0');
function weekStart(dt){return addDays(dt,-dt.getDay());}
function sameWeek(a,b){return weekStart(fromKey(a)).getTime()===weekStart(fromKey(b)).getTime();}
function isoWeekMonday(k){
  const dt=fromKey(k),offset=dt.getDay()===0?-6:1-dt.getDay();
  return addDays(dt,offset);
}
function weekNumber(k){
  const d=fromKey(k);
  const monday=addDays(d,d.getDay()===0?1:1-d.getDay());
  const u=new Date(Date.UTC(monday.getFullYear(),monday.getMonth(),monday.getDate()));
  u.setUTCDate(u.getUTCDate()+4-(u.getUTCDay()||7));
  const y0=new Date(Date.UTC(u.getUTCFullYear(),0,1));
  return Math.ceil((((u-y0)/864e5)+1)/7);
}
