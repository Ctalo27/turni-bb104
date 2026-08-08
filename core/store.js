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
function normalizeStored(source){
  const preset=source.patternId&&PATTERNS[source.patternId]?source.patternId:matchingPatternId(source.pattern);
  M=defaults();
  M.patternId=preset||'BB104';
  M.switches=Array.isArray(source.switches)?source.switches:[];
  M.special=source.special&&typeof source.special==='object'?{...source.special}:{};
}
function load(){
  if(CAN_STORE){try{
    const s=localStorage.getItem('bb104v6');
    if(s){normalizeStored(JSON.parse(s));save();return;}
    const v5=localStorage.getItem('bb104v5');
    if(v5){normalizeStored(JSON.parse(v5));save();return;}
  }catch(e){}}
  M=defaults();save();
}
