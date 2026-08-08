/* ═══ FESTIVITÀ NAZIONALI ═══ */
function easterMonday(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da+1);}
const HOLS={};
const HOLS_NAMES={'1-1':'Capodanno','1-6':'Epifania','4-25':'25 Aprile','5-1':'1° Maggio','6-2':'2 Giugno','8-15':'Ferragosto','10-4':'San Francesco d’Assisi','11-1':'Ognissanti','11-9':'Festa patronale','12-8':'Immacolata','12-25':'Natale','12-26':'Santo Stefano','pasqua':'Pasqua','pasquetta':'Pasquetta'};
function ensureHolidayYear(y){if(HOLS[`${y}-1-1`])return;const em=easterMonday(y),es=new Date(em.getFullYear(),em.getMonth(),em.getDate()-1);['1-1','1-6','4-25','5-1','6-2','8-15','10-4','11-1','11-9','12-8','12-25','12-26'].forEach(d=>HOLS[`${y}-${d}`]=d);HOLS[`${y}-${es.getMonth()+1}-${es.getDate()}`]='pasqua';HOLS[`${y}-${em.getMonth()+1}-${em.getDate()}`]='pasquetta';}
ensureHolidayYear(_cy);
function natHolName(k){if(!HOLS[k])return null;const p=k.split('-');return HOLS_NAMES[HOLS[k]]||HOLS_NAMES[`${p[1]}-${p[2]}`]||'Festività';}
