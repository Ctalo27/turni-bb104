/* ═══ STATO DATI + PERSISTENZA ═══ */
let M=null;
const WK_CLS={work:'work',wh:'work',swin:'work',double:'work',special:'work',swout:'swout',extra:'extra',hol:'hol'};

function defaults(){
  return {
    patternId:'BB104',
    defTime:{s:'00:30',e:'07:30'},
    switches:[],
    special:{}
  };
}

const CAN_STORE=(()=>{try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return true;}catch(e){return false;}})();
function save(){if(!CAN_STORE)return;try{localStorage.setItem('bb104v6',JSON.stringify(M));}catch(e){toast('⚠️ Impossibile salvare (memoria piena?)');}}
function preserveLegacy(source){
  if(!CAN_STORE)return;
  try{localStorage.setItem('turni-legacy-backup-v7',JSON.stringify(source));}catch(e){}
}
function migrateLegacy(source){
  const preset=source.patternId&&PATTERNS[source.patternId]?source.patternId:matchingPatternId(source.pattern);
  const hadCustomTime=source.defTime&&(source.defTime.s!=='00:30'||source.defTime.e!=='07:30');
  const hadRetired=!!(source.off||source.budget||source.patLock||source.patternName==='Personalizzato'||source.customHols||source.notifEnabled||hadCustomTime||(source.pattern&&!preset));
  if(hadRetired)preserveLegacy(source);
  M=defaults();
  M.patternId=preset||'BB104';
  M.switches=Array.isArray(source.switches)?source.switches:[];
  M.special=source.special&&typeof source.special==='object'?{...source.special}:{};
}
function load(){
  if(CAN_STORE){try{
    const s=localStorage.getItem('bb104v6');
    if(s){migrateLegacy(JSON.parse(s));save();return;}
    const v5=localStorage.getItem('bb104v5');
    if(v5){migrateLegacy(JSON.parse(v5));save();return;}
  }catch(e){}}
  M=defaults();save();
}
