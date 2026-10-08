(() => {
'use strict';
// ================= costanti =================
const LBL=[{k:'kcal',l:'Energia',u:'kcal'},{k:'prot',l:'Proteine',u:'g'},{k:'carb',l:'Carboidrati',u:'g'},{k:'sug',l:'di cui zuccheri',u:'g'},
  {k:'fat',l:'Grassi',u:'g'},{k:'sat',l:'di cui saturi',u:'g'},{k:'fib',l:'Fibre',u:'g'},{k:'salt',l:'Sale',u:'g'}];
const MIC=[{k:'k',l:'Potassio',u:'mg',ref:3900},{k:'ca',l:'Calcio',u:'mg',ref:1000},{k:'mg',l:'Magnesio',u:'mg',ref:240},
  {k:'fe',l:'Ferro',u:'mg',ref:10},{k:'zn',l:'Zinco',u:'mg',ref:12},{k:'vita',l:'Vitamina A',u:'µg',ref:700},
  {k:'vitc',l:'Vitamina C',u:'mg',ref:105},{k:'vitd',l:'Vitamina D',u:'µg',ref:15},{k:'vite',l:'Vitamina E',u:'mg',ref:13},
  {k:'b12',l:'Vitamina B12',u:'µg',ref:2.4},{k:'fol',l:'Folati',u:'µg',ref:400}];
const MEALS=['colazione','pranzo','spuntino','cena'];
const DEF_T={kcal:2400,prot:150,carb:280,fat:75,fib:30,salt:5,sug:60};
const KEY='dm.v1';
const SC_DEF='Diario Macro';

// ================= dati locali =================
function load(){try{const r=localStorage.getItem(KEY);if(r)return JSON.parse(r)}catch(e){}return null}
let D=load();
if(!D){const s=window.DM_SEED||{};D={foods:s.foods||{},days:{},settings:s.settings||null,created:Date.now()}}
let saveT;function save(){clearTimeout(saveT);saveT=setTimeout(saveNow,150)}
function saveNow(){try{localStorage.setItem(KEY,JSON.stringify(D))}catch(e){toast('Memoria piena: esporta un backup')}}
window.addEventListener('pagehide',saveNow);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow()});
try{navigator.storage?.persist?.()}catch(e){}
let FDB=[];fetch('fooddb.json').then(r=>r.json()).then(j=>{FDB=j.map((f,i)=>({...f,id:'db:'+i}));renderResults()}).catch(()=>{});

// ================= utilità =================
const $=id=>document.getElementById(id);
function todayStr(d=new Date()){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function shift(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return todayStr(d)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v){const n=Number(String(v??'').trim().replace(',','.'));return isFinite(n)?n:0}
function fmt(n,d=0){return (Number(n)||0).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d})}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function T(){return Object.assign({},DEF_T,D.settings?.targets||{})}
function nut(per100,micro,g){const f=g/100,o={};LBL.forEach(x=>o[x.k]=num(per100?.[x.k])*f);MIC.forEach(x=>o[x.k]=micro&&micro[x.k]!=null?num(micro[x.k])*f:0);return o}
function totals(list){const t={};[...LBL,...MIC].forEach(x=>t[x.k]=0);let wm=0;
  list.forEach(e=>{const n=nut(e.per100,e.micro,e.grams);for(const k in n)t[k]+=n[k];if(e.micro&&Object.keys(e.micro).length)wm++});t._micro=wm;return t}
function curMeal(){return S.meal&&Date.now()-(S.mealT||0)<45*60e3?S.meal:autoMeal()}
function autoMeal(){const d=new Date(),h=d.getHours()+d.getMinutes()/60;return h<11?'colazione':h<15?'pranzo':h<18.5?'spuntino':'cena'}
function dateLabel(ds){const t=todayStr();if(ds===t)return 'Oggi';if(ds===shift(t,-1))return 'Ieri';
  return new Date(ds+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}
let toastT;function toast(m){document.querySelector('.toast')?.remove();const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);clearTimeout(toastT);toastT=setTimeout(()=>d.remove(),2400)}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function foods(){return Object.entries(D.foods).map(([id,f])=>({id,...f}))}
function food(id){const f=D.foods[id];return f?{id,...f}:null}
function entries(ds=S.date){return D.days[ds]||[]}

// ================= allenamento e peso =================
const WD=['L','M','M','G','V','S','D'];
function wdIdx(ds){return (new Date(ds+'T12:00:00').getDay()+6)%7}
function trainCfg(){return {on:true,plus:250,minus:0,days:[],...(D.settings?.train||{})}}
function trainInfo(ds){const c=trainCfg(),o=D.dayType?.[ds];if(o)return {train:o==='train',src:'scelto da te'};
  const b=D.health?.burn?.[ds];if(b&&b.hevy>0)return {train:true,src:'da Hevy'};
  if(c.days.includes(wdIdx(ds)))return {train:true,src:'da calendario'};return {train:false,src:'da calendario'}}
function planned(ds){const b=T(),c=trainCfg();if(!c.on)return {...b,_tdelta:0,_train:null};const ti=trainInfo(ds);const dl=ti.train?num(c.plus):-num(c.minus);
  return {...b,kcal:b.kcal+dl,carb:Math.max(0,Math.round(b.carb+dl/4)),_tdelta:dl,_train:ti}}
function wList(){return Object.entries(D.weights||{}).sort((a,b)=>a[0]<b[0]?-1:1)}
function tdeeEst(){const end=todayStr(),start=shift(end,-28),base=T().kcal,c=trainCfg();const ks=[];let tr=0;
  for(let d=start;d<end;d=shift(d,1)){const es=D.days[d];if(!es||!es.length)continue;const k=totals(es).kcal;if(k<base*.5)continue;ks.push(k);if(c.on&&trainInfo(d).train)tr++}
  const x0=new Date(start+'T12:00:00').getTime();const pts=wList().filter(([d])=>d>=start&&d<=end).map(([d,w])=>[(new Date(d+'T12:00:00').getTime()-x0)/864e5,w]);
  const span=pts.length?pts[pts.length-1][0]-pts[0][0]:0;const out={days:ks.length,ws:pts.length,span};
  if(ks.length<10||pts.length<4||span<14)return out;
  const mx=pts.reduce((a,p)=>a+p[0],0)/pts.length,my=pts.reduce((a,p)=>a+p[1],0)/pts.length;
  const slope=pts.reduce((a,p)=>a+(p[0]-mx)*(p[1]-my),0)/Math.max(1e-9,pts.reduce((a,p)=>a+(p[0]-mx)**2,0));
  const intake=ks.reduce((a,b)=>a+b,0)/ks.length,tdee=intake-slope*7700;if(tdee<1200||tdee>5000)return {...out,weird:true};
  const obj=D.settings?.calc?.obj||'mantenimento',f=obj==='definizione'?.85:obj==='massa'?1.1:1,target=tdee*f;
  const share=tr/ks.length,baseK=c.on?target-(share*num(c.plus)-(1-share)*num(c.minus)):target;
  return {...out,ok:true,intake,kgw:slope*7,obj,tdee:Math.round(tdee/10)*10,target:Math.round(target/10)*10,base:Math.round(baseK/10)*10}}
function applyTdee(e){const t=T(),kcal=e.base,carb=Math.max(0,Math.round((kcal-t.prot*4-t.fat*9)/4));D.settings={...(D.settings||{}),targets:{...t,kcal,carb},tdeeApplied:todayStr()};save()}
function wSpark(){const ws=wList().slice(-30);if(ws.length<2)return '';const v=ws.map(x=>x[1]),lo=Math.min(...v)-.3,hi=Math.max(...v)+.3;
  const pts=ws.map(([d,w],i)=>`${(i/(ws.length-1)*300).toFixed(1)},${(56-(w-lo)/(hi-lo)*52).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 300 60" width="100%" height="60" role="img" aria-label="Andamento peso"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>
   <div class="row between small muted num"><span>${new Date(ws[0][0]+'T12:00:00').toLocaleDateString('it-IT',{day:'numeric',month:'short'})} · ${fmt(ws[0][1],1)} kg</span><span>${fmt(ws[ws.length-1][1],1)} kg</span></div>`}

// ================= saldo settimanale =================
function weekStart(ds){const d=new Date(ds+'T12:00:00');return shift(ds,-((d.getDay()+6)%7))}
function weekBal(ds){let B=0;for(let d=weekStart(ds);d<ds;d=shift(d,1)){const es=D.days[d];if(es&&es.length)B+=totals(es).kcal-planned(d).kcal}return B}
function carryMode(){return D.settings?.carry||'over'}
function weekAdj(ds){const mode=carryMode();if(mode==='off')return 0;const B=weekBal(ds);const a=mode==='over'?-Math.max(0,B):-B;const cap=Math.round(T().kcal*.3);return Math.round(Math.max(-cap,Math.min(cap,a))/10)*10}
function Tday(ds=S.date){const b=planned(ds),a=weekAdj(ds);if(!a)return {...b,_adj:0};const k=b.kcal+a,np=Math.max(1,b.kcal-b.prot*4),r=Math.max(0,(k-b.prot*4)/np);
  return {...b,kcal:k,carb:Math.round(b.carb*r),fat:Math.round(b.fat*r),_adj:a}}
function remaining(){const t=totals(entries()),g=Tday();return {kcal:g.kcal-t.kcal,prot:g.prot-t.prot,carb:g.carb-t.carb,fat:g.fat-t.fat}}
function plural(w){return w.split(' ').map((x,i)=>i?x:x.replace(/[oae]$/,c=>({o:'i',a:'e',e:'i'})[c])).join(' ')}
function byUse(a,b){return (b.uses||0)-(a.uses||0)||(b.lastUsed||0)-(a.lastUsed||0)||a.name.localeCompare(b.name)}
function sheet(html){const v=document.createElement('div');v.className='veil';v.innerHTML=`<div class="sheet" role="dialog">${html}</div>`;document.body.append(v);return v}
function ensureSaved(f){if(f.id&&D.foods[f.id])return food(f.id);
  const dup=foods().find(x=>(f.ean&&x.ean===f.ean)||(norm(x.name)===norm(f.name)&&(x.brand||'')===(f.brand||'')));if(dup)return dup;
  const id=uid();const {id:_,...body}=f;D.foods[id]={...body,created:Date.now(),uses:0};save();return food(id)}

const S={tab:'oggi',date:todayStr(),meal:null,combo:{sel:new Set(),prio:'bilanciato'},fq:'',online:null,onlineQ:'',onlineBusy:false};

// ================= ricerca =================
function lev1(a,b){if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}
  return e+(a.length-i)+(b.length-j)<=1}
function scoreFood(f,q){if(!q)return 0;const qt=q.split(' ').filter(Boolean);let best=0;
  for(const c of [f.name,...(f.aliases||[]),(f.brand||'')+' '+f.name,f.ean||'']){const n=norm(c);if(!n)continue;
    if(n===q){best=Math.max(best,100);continue}
    if(n.startsWith(q+' ')||q.startsWith(n+' ')||n.startsWith(q))best=Math.max(best,82);
    const ct=n.split(' ');let hit=0;
    for(const t of qt){if(ct.some(w=>w===t||(t.length>=3&&w.startsWith(t))||(t.length>=4&&lev1(w,t))||(w.length>=4&&t.startsWith(w))))hit++}
    if(hit)best=Math.max(best,Math.round(70*hit/qt.length)-(ct.length>qt.length+2?5:0));}
  return best?best+Math.min(8,Math.log2(1+(f.uses||0))*2):0}
function match(q,n=6){return foods().map(f=>({f,s:scoreFood(f,q)})).filter(x=>x.s>=35).sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.f)}
function matchDb(q,n=8){const mine=new Set(foods().map(f=>norm(f.name)));
  return FDB.map(f=>({f,s:scoreFood(f,q)})).filter(x=>x.s>=35&&!mine.has(norm(x.f.name))).sort((a,b)=>b.s-a.s).slice(0,n).map(x=>x.f)}

// testo con quantità ("80 g pasta, 1 banana")
const STOP=new Set(['di','del','della','dello','dei','delle','degli','d','con','il','la','lo','le','gli','i','l','un','una','uno','al','allo','alla','ai','ho','mangiato','circa','da']);
const WNUM={mezzo:.5,mezza:.5,un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5};
const MASS={g:1,gr:1,grammi:1,grammo:1,kg:1000,ml:1,cl:10,dl:100,l:1000,lt:1000,litro:1000,litri:1000};
const UNITW=new Set(['pz','pezzo','pezzi','fetta','fette','vasetto','vasetti','misurino','misurini','cucchiaio','cucchiai','cucchiaino','cucchiaini','bicchiere','bicchieri','porzione','porzioni','tazza','tazze','scatoletta','scatolette','barretta','barrette','scoop']);
function parseChunk(raw){let s=' '+norm(raw.replace(/(\d),(\d)/g,'$1p$2').replace(/(\d)\.(\d)/g,'$1p$2'))+' ';s=s.replace(/(\d)p(\d)/g,'$1.$2');
  let n=null,mult=null;const m=s.match(/ (\d+(?:\.\d+)?)\s?(kg|gr|grammi|grammo|g|ml|cl|dl|lt|l|litri|litro)? /);
  if(m){n=parseFloat(m[1]);if(m[2])mult=MASS[m[2]];s=s.replace(m[0],' ')}
  else for(const w in WNUM){const re=new RegExp(' '+w+' ');if(re.test(s)){n=WNUM[w];s=s.replace(re,' ');break}}
  return {q:s.trim().split(/\s+/).filter(t=>t&&!UNITW.has(t)&&!STOP.has(t)&&!['colazione','pranzo','cena','spuntino'].includes(t)).join(' '),n,mult}}
function parseText(text){return text.split(/,(?!\d)|(?<!\d),|[;\n+]| e (?=\d|un |una |mezz|due |tre )/i).map(c=>c.trim()).filter(Boolean).map(c=>{
  const p=parseChunk(c);let f=p.q?(match(p.q,1)[0]||matchDb(p.q,1)[0]):null;let g=0;
  if(f){g=p.mult?p.n*p.mult:f.unit?.grams?(p.n??1)*f.unit.grams:p.n!=null?(p.n>=10?p.n:p.n*100):100}
  return {raw:c,q:p.q,food:f,grams:Math.round(g)}}).filter(x=>x.q)}
function isEan(t){return /^\d{8,14}$/.test(t.replace(/\s/g,''))}

// ================= registrazione =================
function addEntries(list){if(!list.length)return;const arr=D.days[S.date]||(D.days[S.date]=[]);
  list.forEach(({food:f0,grams,meal})=>{const f=ensureSaved(f0);
    arr.push({id:uid(),foodId:f.id,name:f.name,brand:f.brand||null,grams:Math.round(grams),meal,t:Date.now(),per100:f.per100,micro:f.micro||null});
    const r=D.foods[f.id];r.uses=(r.uses||0)+1;r.lastUsed=Date.now();r.lastGrams=Math.round(grams)});
  save();renderAll()}
function clearSearch(){$('q').value='';S.online=null;S.onlineQ='';renderResults()}

// ================= foglio quantità =================
function openQty(f,opt={}){const edit=opt.entry;let meal=edit?edit.meal:(curMeal());
  let g=Math.round(edit?edit.grams:(f.lastGrams||f.unit?.grams||100));const unit=f.unit&&f.unit.grams?f.unit:null;
  const grams=[...new Set([50,100,150,200,250,300])].filter(x=>x!==f.lastGrams);
  const v=sheet(`<div class="head"><div><h2>${esc(f.name)}</h2><div class="small muted">${f.brand?esc(f.brand)+' · ':''}${fmt(f.per100?.kcal)} kcal per 100 g</div></div><button class="ghost" data-x="close">Chiudi</button></div>
    <div class="gbox"><button class="step" data-s="-1" aria-label="meno">−</button><div class="gval"><input id="qg" inputmode="numeric" value="${g}" aria-label="grammi"><span>g</span></div><button class="step" data-s="1" aria-label="più">+</button></div>
    <div class="qmac" id="qmac"></div>
    <div class="hscroll">${unit?[0.5,1,2,3].map(u=>`<button class="chip" data-g="${Math.round(u*unit.grams)}">${u===0.5?'½':u} ${esc(u>1?plural(unit.name):unit.name)}</button>`).join(''):''}
      ${f.lastGrams?`<button class="chip" data-g="${f.lastGrams}">★ ${f.lastGrams} g</button>`:''}${grams.map(x=>`<button class="chip" data-g="${x}">${x} g</button>`).join('')}</div>
    <div class="seg" id="qmeal">${MEALS.map(m=>`<button class="${m===meal?'on':''}" data-m="${m}">${m}</button>`).join('')}</div>
    <button class="primary big" data-x="ok">${edit?'Salva':'Aggiungi'}</button>
    ${edit?`<button class="danger" data-x="del">Elimina dal diario</button>`:''}
    ${!edit&&(!f.id||!D.foods[f.id])?`<div class="hint">Verrà salvato nel tuo archivio per ritrovarlo subito la prossima volta.</div>`:''}`);
  const inp=v.querySelector('#qg');
  const upd=()=>{g=Math.max(0,Math.round(num(inp.value)));const n=nut(f.per100,null,g);const left=remaining().kcal+(edit?nut(edit.per100,null,edit.grams).kcal:0)-n.kcal;
    v.querySelector('#qmac').innerHTML=`<b>${fmt(n.kcal)} kcal</b> · P ${fmt(n.prot)} · C ${fmt(n.carb)} · G ${fmt(n.fat)}<br><span class="small">${left>=0?`poi te ne restano ${fmt(left)}`:`supereresti di ${fmt(-left)} kcal`}</span>`};
  const set=x=>{inp.value=Math.max(0,Math.round(x));upd()};upd();
  inp.addEventListener('input',upd);inp.addEventListener('focus',()=>inp.select());
  v.addEventListener('click',ev=>{if(ev.target===v){v.remove();return}const b=ev.target.closest('button');if(!b)return;
    if(b.dataset.s){const cur=num(inp.value);const st=cur<50?5:10;set(cur+st*num(b.dataset.s))}
    if(b.dataset.g)set(num(b.dataset.g));
    if(b.dataset.m){meal=b.dataset.m;v.querySelectorAll('#qmeal button').forEach(c=>c.classList.toggle('on',c.dataset.m===meal))}
    const x=b.dataset.x;if(x==='close')v.remove();
    if(x==='del'){D.days[S.date]=entries().filter(e=>e.id!==edit.id);save();v.remove();renderAll();toast('Eliminato')}
    if(x==='ok'){if(g<=0){toast('Scegli i grammi');return}
      if(edit){edit.grams=g;edit.meal=meal;save();v.remove();renderAll();return}
      S.meal=meal;S.mealT=Date.now();addEntries([{food:f,grams:g,meal}]);v.remove();clearSearch();toast(`${f.name} · ${g} g aggiunto`)}})}

// ================= Oggi =================

// ================= Apple Health (via Comandi Rapidi) =================
function H(){if(!D.health)D.health={sent:{},burn:{},pending:null};D.health.sent=D.health.sent||{};D.health.burn=D.health.burn||{};return D.health}
function scName(){return (D.settings?.shortcut||SC_DEF).trim()||SC_DEF}
function localISO(d){const z=n=>String(n).padStart(2,'0');return `${todayStr(d)}T${z(d.getHours())}:${z(d.getMinutes())}:00`}
function hhmm(d=new Date()){return d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
function pnum(v){let x=String(v??'').replace(/[^\d.,-]/g,'');if(!x)return 0;
  if(x.includes('.')&&x.includes(','))x=x.replace(/\./g,'').replace(',','.');
  else if(x.includes(','))x=x.replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(x))x=x.replace(/\./g,'');
  const n=parseFloat(x);return isFinite(n)?n:0}
const HK=['kcal','prot','carb','fat'];
function healthBlock(t){const h=H(),b=h.burn[S.date],p=h.pending;let out='';
  if(trainCfg().on){const ti=trainInfo(S.date);out+=`<div class="row"><button class="chip ${ti.train?'on':''}" data-act="ttoggle">${ti.train?'Giorno di allenamento':'Giorno di riposo'}</button><span class="small muted">${ti.src} · tocca per cambiare</span></div>`}
  if(b){const spent=b.active+b.rest,bal=t.kcal-spent;
    out+=`<div class="row between small"><span class="muted">Spese <span class="num">${fmt(spent)}</span> kcal · ${fmt(b.active)} attive + ${fmt(b.rest)} a riposo (ore ${esc(b.at)})</span>
      <span class="num"><b>${bal>=0?'Surplus':'Deficit'} ${fmt(Math.abs(bal))}</b></span></div>`}
  out+=`<div class="row"><button data-act="hsync">Sincronizza con Salute</button>${p?`<button class="primary" data-act="hpaste">Incolla da Salute</button>`:''}<button class="ghost small" data-act="hburn">kcal spese a mano</button></div>`;
  if(p)out+=`<div class="hint">Dopo il Comando Rapido torna qui e tocca «Incolla da Salute»: conferma l'invio e legge le calorie spese.</div>`;
  return out}
function syncHealth(){const h=H(),t=totals(entries()),s=h.sent[S.date]||{};const d={};let neg=false,any=false;
  HK.forEach(k=>{const v=t[k]-(s[k]||0);const r=k==='kcal'?Math.round(v):Math.round(v*10)/10;d[k]=Math.max(0,r);if(r<0)neg=true;if(r>0)any=true});
  const id=uid();const when=S.date===todayStr()?localISO(new Date()):S.date+'T21:00:00';
  const go=()=>{h.pending={id,date:S.date,totals:Object.fromEntries(HK.map(k=>[k,Math.max(t[k],s[k]||0)])),ts:Date.now()};saveNow();renderSummary();
    location.href='shortcuts://run-shortcut?name='+encodeURIComponent(scName())+'&input=text&text='+encodeURIComponent(JSON.stringify({id,when,log:any?1:0,...d}))};
  if(!neg){go();return}
  const v=sheet(`<h2>Hai tolto alimenti</h2><p class="small">Dopo l'ultimo invio il totale di questo giorno è sceso. Da qui non posso togliere dati da Salute: se vuoi i numeri esatti, cancella a mano i campioni in Salute → Nutrizione. Ora invio solo gli aumenti.</p>
    <button class="primary" data-x="go">Continua</button><button class="ghost" data-x="close">Annulla</button>`);
  v.addEventListener('click',ev=>{const x=ev.target.closest('[data-x]')?.dataset.x;if(!x&&ev.target!==v)return;v.remove();if(x==='go')go()})}
async function pasteHealth(){let txt='';try{txt=await navigator.clipboard.readText()}catch(e){toast('Non riesco a leggere gli appunti');return}
  const m=String(txt).match(/DMSYNC\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)(?:\|([^|\n]*))?(?:\|([^|\n]*))?/);if(!m){toast('Negli appunti non ci sono dati di Salute');return}
  const h=H(),[,id,a,r,hv,wt]=m,p=h.pending;const w=pnum(wt);if(w>=30&&w<=250){D.weights=D.weights||{};D.weights[todayStr()]=Math.round(w*10)/10}
  if(p&&p.id===id.trim()){h.sent[p.date]=p.totals;h.pending=null}
  h.burn[todayStr()]={active:Math.round(pnum(a)),rest:Math.round(pnum(r)),hevy:Math.round(pnum(hv)),at:hhmm()};saveNow();renderSummary();
  toast(p&&!h.pending?'Salute aggiornata':'Calorie spese aggiornate')}
function manualBurn(){const b=H().burn[S.date]||{active:'',rest:''};
  const v=sheet(`<h2>Calorie spese</h2><div class="grid2"><label>Attive<input id="hb_a" inputmode="decimal" value="${esc(b.active)}"></label><label>A riposo<input id="hb_r" inputmode="decimal" value="${esc(b.rest)}"></label></div>
    <button class="primary" data-x="ok">Salva</button><button class="ghost" data-x="del">Cancella</button>`);
  v.addEventListener('click',ev=>{const x=ev.target.closest('[data-x]')?.dataset.x;if(!x&&ev.target!==v)return;const h=H();
    if(x==='ok')h.burn[S.date]={active:Math.round(pnum(v.querySelector('#hb_a').value)),rest:Math.round(pnum(v.querySelector('#hb_r').value)),at:'a mano'};
    if(x==='del')delete h.burn[S.date];saveNow();v.remove();renderSummary()})}
function renderAll(){$('dateLabel').textContent=dateLabel(S.date);$('nextDay').disabled=S.date>=todayStr();
  $('datenav').style.visibility=S.tab==='oggi'?'visible':'hidden';$('title').textContent=S.tab==='oggi'?'Diario':S.tab==='alimenti'?'Alimenti':'Profilo';
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));
  ['oggi','alimenti','profilo'].forEach(t=>{$('p-'+t).hidden=t!==S.tab;$('p-'+t).style.display=t===S.tab?'flex':'none'});
  if(S.tab==='oggi'){renderSummary();renderResults();renderRecent();renderMeals()}
  if(S.tab==='alimenti')renderArchive();if(S.tab==='profilo')renderProfile()}
function renderSummary(){const t=totals(entries()),g=Tday();const left=g.kcal-t.kcal;
  const mb=(l,v,tg,c)=>`<div class="mac"><div class="t">${l}</div><div class="v num">${fmt(v)}<span class="muted small"> / ${fmt(tg)} g</span></div><div class="track"><div class="fill" style="width:${Math.min(100,v/tg*100)}%;background:${v>tg*1.08?'var(--warn)':c}"></div></div></div>`;
  $('summary').innerHTML=`<section class="card hero">
   <div class="row between"><div><div class="small muted">${left>=0?'Ti restano':'Sei oltre di'}</div><div class="left ${left<0?'over':''}"><span class="n num">${fmt(Math.abs(left))}</span><span class="muted">kcal</span></div></div>
    <div class="small muted num" style="text-align:right">${fmt(t.kcal)} mangiate<br>obiettivo ${fmt(g.kcal)}${g._adj?`<br><span class="adj ${g._adj<0?'neg':''}">${g._adj>0?'+':'−'}${fmt(Math.abs(g._adj))} saldo settimana</span>`:''}${g._tdelta?`<br><span class="adj">${g._tdelta>0?'+':'−'}${fmt(Math.abs(g._tdelta))} ${g._tdelta>0?'allenamento':'riposo'}</span>`:''}</div></div>
   <div class="track"><div class="fill" style="width:${Math.min(100,t.kcal/g.kcal*100)}%;${left<0?'background:var(--warn)':''}"></div></div>
   <div class="macros">${mb('Proteine',t.prot,g.prot,'var(--p)')}${mb('Carboidrati',t.carb,g.carb,'var(--c)')}${mb('Grassi',t.fat,g.fat,'var(--f)')}</div>
   ${left>30?`<button class="primary" data-act="combo">Completa la giornata</button>`:''}${healthBlock(t)}</section>`}

let lastRes={};
function resBtn(f){lastRes[f.id]=f;const p=f.per100||{};
  return `<button class="res" data-pick="${esc(f.id)}"><span class="rn">${esc(f.name)}${f.brand?`<br><span class="rs">${esc(f.brand)}</span>`:''}</span><span class="rk num">${fmt(p.kcal)} kcal/100 g</span></button>`}
function renderResults(){const text=$('q').value.trim();$('clearQ').hidden=!text;$('home').hidden=!!text;const el=$('results');
  if(!text){el.innerHTML='';return}lastRes={};
  if(/\d/.test(text)&&!isEan(text)){const items=parseText(text);const ok=items.filter(i=>i.food&&i.grams>0);const tk=ok.reduce((s,i)=>s+nut(i.food.per100,null,i.grams).kcal,0);
    el.innerHTML=`<section class="card"><div class="label">Ho capito</div><div>${items.map(i=>i.food?`<div class="it" style="cursor:default"><span class="nm">${esc(i.food.name)}</span><span class="g num">${i.grams} g · ${fmt(nut(i.food.per100,null,i.grams).kcal)} kcal</span></div>`:`<div class="it" style="cursor:default"><span class="nm muted">“${esc(i.q)}” non trovato</span></div>`).join('')}</div>
      ${ok.length?`<button class="primary big" data-act="logAll">Aggiungi tutto · ${fmt(tk)} kcal</button>`:''}<div class="hint">Per scegliere i grammi con i tasti, scrivi solo il nome dell’alimento.</div></section>`;return}
  const q=norm(text);const mine=match(q);const db=matchDb(q);const on=S.online&&S.onlineQ===q?S.online:null;
  el.innerHTML=`${isEan(text)?`<button class="primary big" data-act="ean" data-ean="${text.replace(/\s/g,'')}">Cerca codice ${esc(text)}</button>`:''}
   ${mine.length?`<div class="sec"><div class="label">I tuoi alimenti</div><div class="list">${mine.map(resBtn).join('')}</div></div>`:''}
   ${db.length?`<div class="sec"><div class="label">Alimenti comuni</div><div class="list">${db.map(resBtn).join('')}</div></div>`:''}
   ${on?(on.length?`<div class="sec"><div class="label">Prodotti di marca</div><div class="list">${on.map(resBtn).join('')}</div></div>`:`<div class="empty">Nessun prodotto di marca trovato.</div>`):''}
   ${!mine.length&&!db.length&&!on&&!isEan(text)?`<div class="empty">Niente per “${esc(text)}” tra i tuoi alimenti.</div>`:''}
   <div class="row" style="margin-top:6px">${!on&&!isEan(text)?`<button class="grow" data-act="online" ${navigator.onLine&&!S.onlineBusy?'':'disabled'}>${S.onlineBusy?'Cerco…':navigator.onLine?'Cerca prodotti di marca':'Prodotti di marca: serve internet'}</button>`:''}
   <button class="grow" data-act="create" data-name="${esc(text)}">Crea dall’etichetta</button></div>`}
function recentFoods(n){const seen=new Set(),out=[];const days=Object.keys(D.days).sort().reverse().slice(0,14);
  for(const ds of days)for(const e of [...D.days[ds]].reverse()){if(seen.has(e.foodId)||!D.foods[e.foodId])continue;seen.add(e.foodId);out.push(food(e.foodId));if(out.length>=n)return out}
  foods().sort(byUse).forEach(f=>{if(out.length<n&&!seen.has(f.id)){seen.add(f.id);out.push(f)}});return out}
function renderRecent(){const r=recentFoods(15);$('recent').innerHTML=r.length?`<div class="label" style="margin:0 0 8px">Veloci</div><div class="hscroll">${r.map(f=>`<button class="chip" data-act="qty" data-food="${esc(f.id)}">${esc(f.name.replace(/ \(.*\)$/,''))}</button>`).join('')}</div>`:''}
function renderMeals(){const es=entries();const t=totals(es),g=Tday();
  const cards=MEALS.map((m,i)=>{const list=es.filter(e=>e.meal===m);const mt=totals(list);
   return `<section class="mealc m${i+1}"><div class="mh"><h3>${m}</h3><span class="mk num">${list.length?fmt(mt.kcal)+' kcal':''}</span>
     <button class="add" data-act="addto" data-meal="${m}" aria-label="Aggiungi a ${m}">+</button></div>
     ${list.length?`<div class="mm small num">P ${fmt(mt.prot)} · C ${fmt(mt.carb)} · G ${fmt(mt.fat)}</div>${list.map(e=>`<div class="it" data-act="edit" data-id="${e.id}"><span class="nm">${esc(e.name)} <span class="g num">${fmt(e.grams)} g</span></span><span class="k num">${fmt(nut(e.per100,null,e.grams).kcal)}</span></div>`).join('')}`
      :`<button class="mempty" data-act="addto" data-meal="${m}">Aggiungi qualcosa</button>`}</section>`}).join('');
  $('meals').innerHTML=`<div class="meals">${cards}</div>${!es.length?'':`<section class="card" style="margin-top:12px"><details><summary>Fibre, sale, vitamine e minerali ›</summary><div class="micro">
    ${[['Fibre',t.fib,g.fib,'g'],['Zuccheri',t.sug,g.sug,'g',1],['Sale',t.salt,g.salt,'g',1],...MIC.map(m=>[m.l,t[m.k],m.ref,m.u])].map(([l,v,tg,u,mx])=>`<div><div class="t"><span>${l}</span><span class="num ${mx&&v>tg?'muted':''}">${fmt(v,v<10?1:0)} / ${fmt(tg,tg<10?1:0)} ${u}</span></div><div class="track"><div class="fill" style="width:${Math.min(100,v/tg*100)}%;${mx&&v>tg?'background:var(--warn)':''}"></div></div></div>`).join('')}
   </div><p class="hint">Vitamine e minerali contano solo gli alimenti che li hanno in scheda (${t._micro} su ${es.length}). Riferimenti LARN per un uomo adulto.</p></details></section>`}`}

// ================= combinazioni =================
const PRIO={'bilanciato':{P:1.5,C:1,F:1},'più proteine':{P:4,C:.6,F:.8},'meno grassi':{P:1.5,C:1,F:3}};
function solver(rem,prio){const W=PRIO[prio]||PRIO.bilanciato;const tK=Math.max(0,rem.kcal),tP=Math.max(0,rem.prot),tC=Math.max(0,rem.carb),tF=Math.max(0,rem.fat);const tol=Math.max(20,tK*0.03);
  const prep=(f,wide)=>{const p=f.per100||{};const k=num(p.kcal)/100;const fatty=num(p.fat)>50;const m=wide?1.6:1;
    return {f,k,p:num(p.prot)/100,c:num(p.carb)/100,fa:num(p.fat)/100,min:fatty?5:10,max:Math.round(m*(fatty?40:f.unit&&f.unit.grams>=20?Math.max(f.unit.grams*4,200):k>3?250:600))}};
  const tot=(F,g)=>{let K=0,P=0,C=0,Fa=0;F.forEach((x,j)=>{K+=x.k*g[j];P+=x.p*g[j];C+=x.c*g[j];Fa+=x.fa*g[j]});return {K,P,C,Fa}};
  const mErr=t=>W.P*((t.P-tP)/Math.max(tP,15))**2+W.C*((t.C-tC)/Math.max(tC,20))**2+W.F*((t.Fa-tF)/Math.max(tF,8))**2;
  const score=(F,g)=>{const t=tot(F,g);const dk=(t.K-tK)/Math.max(tK,100);return 12*dk*dk+mErr(t)};
  function solve(F){const g=F.map(x=>Math.min(x.max,Math.max(x.min,Math.round((tK/F.length)/x.k/5)*5)));let best=score(F,g);
    for(let r=0;r<80;r++){let imp=false;for(let j=0;j<F.length;j++){const x=F[j];for(const d of [5,-5,25,-25,100,-100]){const v=g[j]+d;if(v<x.min||v>x.max)continue;g[j]=v;const s=score(F,g);if(s<best-1e-9){best=s;imp=true}else g[j]-=d}}if(!imp)break}
    for(let r=0;r<100;r++){const t=tot(F,g);const diff=tK-t.K;if(Math.abs(diff)<=tol/2)break;let bj=-1,bv=Infinity,bd=0;
      for(let j=0;j<F.length;j++){const x=F[j];const d=diff>0?5:-5;const v=g[j]+d;if(v<x.min||v>x.max)continue;g[j]=v;const nt=tot(F,g);const s=Math.abs(tK-nt.K)*3/Math.max(tK,100)+mErr(nt);g[j]-=d;if(s<bv){bv=s;bj=j;bd=d}}
      if(bj<0)break;g[bj]+=bd}
    const t=tot(F,g);return {items:F.map((x,j)=>({food:x.f,grams:g[j]})),kcal:t.K,ok:Math.abs(t.K-tK)<=tol,s:mErr(t)}}
  return {prep,solve,tK}}
function combos(rem,sel,prio){const {prep,solve}=solver(rem,prio);const out={all:null,alt:[]};
  const chosen=sel.map(f=>prep(f,true)).filter(x=>x.k>0.05);
  if(chosen.length)out.all=solve(chosen);
  const pool=(chosen.length>=3?sel.map(f=>prep(f)):foods().sort(byUse).slice(0,20).map(f=>prep(f))).filter(x=>x.k>0.05);const res=[];const n=pool.length;
  for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){res.push(solve([pool[a],pool[b]]));for(let c=b+1;c<n;c++)res.push(solve([pool[a],pool[b],pool[c]]))}
  const allKey=out.all?out.all.items.map(i=>i.food.id).sort().join():'';const used={};
  for(const r of res.filter(r=>r.ok).sort((x,y)=>x.s-y.s)){const key=r.items.map(i=>i.food.id).sort().join();if(key===allKey)continue;
    if(r.items.some(i=>(used[i.food.id]||0)>=2))continue;out.alt.push(r);r.items.forEach(i=>used[i.food.id]=(used[i.food.id]||0)+1);if(out.alt.length>=3)break}
  return out}
function openComboFree(){const C=S.combo;let view='pick',q='',res=null;const v=sheet('<div id="cb"></div>');const box=v.querySelector('#cb');box.style.cssText='display:flex;flex-direction:column;gap:14px';
  const optHtml=(o,main)=>`<div class="opt ${main?'main':''}">${o.items.map(i=>`<div class="ln"><span>${esc(i.food.name)}</span><b class="num">${i.grams} g${i.food.unit&&i.grams%i.food.unit.grams===0?` <span class="muted small">(${i.grams/i.food.unit.grams} ${esc(i.food.unit.name)})</span>`:''}</b></div>`).join('')}
    <div class="ln small muted num"><span>Totale</span><span>${fmt(o.kcal)} kcal · P ${fmt(o.items.reduce((s,i)=>s+nut(i.food.per100,null,i.grams).prot,0))} g</span></div>
    ${!o.ok?`<div class="hint">Non arriva alle kcal mancanti senza quantità esagerate: aggiungi un alimento.</div>`:''}
    <button class="primary" data-add="${main?'all':o._i}">Aggiungi questi</button></div>`;
  const draw=()=>{const rem=remaining();
    if(view==='pick'){const list=foods().sort(byUse).filter(f=>!q||scoreFood(f,norm(q))>0);
      box.innerHTML=`<div class="head"><div><h2>Completa la giornata</h2><div class="small muted num">Mancano ${fmt(Math.max(0,rem.kcal))} kcal · P ${fmt(Math.max(0,rem.prot))} · C ${fmt(Math.max(0,rem.carb))} · G ${fmt(Math.max(0,rem.fat))}</div></div><button class="ghost" data-x="close">Chiudi</button></div>
        <div class="label">1 · Scegli cosa vuoi mangiare</div>
        <input id="cq" type="search" placeholder="Filtra" value="${esc(q)}">
        <div class="list">${list.map(f=>`<button class="pick ${C.sel.has(f.id)?'on':''}" data-sel="${f.id}"><span>${esc(f.name)}</span><span class="ck">${C.sel.has(f.id)?'✓':''}</span></button>`).join('')}</div>
        <div class="label">2 · Priorità</div>
        <div class="seg three">${Object.keys(PRIO).map(p=>`<button class="${p===C.prio?'on':''}" data-p="${p}">${p}</button>`).join('')}</div>
        <div class="foot"><button class="primary big" data-x="calc">${C.sel.size?`Calcola con ${C.sel.size===1?'questo alimento':`questi ${C.sel.size}`}`:'Calcola con i miei più usati'}</button></div>`}
    else{const sel=[...C.sel].map(food).filter(Boolean);res.alt.forEach((o,i)=>o._i=i);
      box.innerHTML=`<div class="head"><div><h2>Proposte</h2><div class="small muted num">Mancano ${fmt(Math.max(0,rem.kcal))} kcal</div></div><button class="ghost" data-x="close">Chiudi</button></div>
        ${res.all?`<div class="label">Con ${sel.length===1?'l’alimento scelto':`tutti e ${sel.length} gli alimenti scelti`}</div>${optHtml(res.all,true)}`:''}
        ${res.alt.length?`<div class="label">${res.all?'Altre idee':'Idee con i tuoi alimenti'}</div>${res.alt.map(o=>optHtml(o,false)).join('')}`:''}
        ${!res.all&&!res.alt.length?`<div class="empty">Non trovo combinazioni: scegli qualche alimento in più.</div>`:''}
        <button data-x="back">Cambia alimenti</button>`}
    const cq=box.querySelector('#cq');if(cq&&q){cq.focus();cq.setSelectionRange(q.length,q.length)}};
  draw();
  v.addEventListener('input',e=>{if(e.target.id==='cq'){q=e.target.value;draw()}});
  v.addEventListener('click',e=>{if(e.target===v){v.remove();return}const b=e.target.closest('button');if(!b)return;
    if(b.dataset.sel){const id=b.dataset.sel;C.sel.has(id)?C.sel.delete(id):C.sel.add(id);draw()}
    if(b.dataset.p){C.prio=b.dataset.p;draw()}
    if(b.dataset.add!=null){const o=b.dataset.add==='all'?res.all:res.alt[+b.dataset.add];addEntries(o.items.map(i=>({food:i.food,grams:i.grams,meal:curMeal()})));v.remove();toast('Aggiunto al diario')}
    const x=b.dataset.x;if(x==='close')v.remove();if(x==='back'){view='pick';draw()}
    if(x==='calc'){res=combos(remaining(),[...C.sel].map(food).filter(Boolean),C.prio);view='res';draw();box.parentElement.scrollTop=0}})}

// ================= le tue combinazioni (dosi in proporzione) =================
function recipes(){return D.recipes||(D.recipes=[])}
function stepG(g){return g>=200?10:5}
function scaleRecipe(r,k){const items=r.items.map(i=>({food:food(i.foodId),base:i.g})).filter(i=>i.food).map(i=>{const st=stepG(i.base);return {...i,grams:Math.max(st,Math.round(i.base*k/st)*st)}});
  const n={kcal:0,prot:0,carb:0,fat:0};items.forEach(i=>{const x=nut(i.food.per100,null,i.grams);for(const q in n)n[q]+=x[q]});return {items,n}}
function fitK(r,rem){const b=scaleRecipe(r,1).n.kcal;if(b<=0||rem<=0)return 1;return Math.min(3,Math.max(.25,Math.round(rem/b*20)/20))}
function openCombo(){const K={};let view='list',ed=null,q='',meal=(h=>h>=21||h<5?'spuntino':curMeal())(new Date().getHours());const v=sheet('<div id="rc"></div>');const box=v.querySelector('#rc');box.style.cssText='display:flex;flex-direction:column;gap:14px';
  const rem=()=>remaining();
  const card=r=>{const R=rem();if(K[r.id]==null)K[r.id]=fitK(r,R.kcal);const k=K[r.id];const {items,n}=scaleRecipe(r,k);const after=R.kcal-n.kcal;
    return `<div class="opt ${r===recipes()[0]?'main':''}"><div class="ln"><b>${esc(r.name)}</b><span class="muted small num">×${fmt(k,2)} della tua dose</span></div>
      ${items.map(i=>`<div class="ln"><span>${esc(i.food.name)}</span><b class="num">${i.grams} g <span class="muted small">(${i.base})</span></b></div>`).join('')}
      <div class="ln small muted num"><span>${fmt(n.kcal)} kcal · P ${fmt(n.prot)} · C ${fmt(n.carb)} · G ${fmt(n.fat)}</span><span>${after>=0?`restano ${fmt(after)}`:`oltre di ${fmt(-after)}`}</span></div>
      ${k>=2?`<div class="hint">Più del doppio della tua dose: valuta di aggiungere un altro spuntino.</div>`:''}
      <div class="row"><button data-k="-" data-r="${r.id}" aria-label="meno">−</button><button data-k="+" data-r="${r.id}" aria-label="più">+</button><button data-k="fit" data-r="${r.id}">Adatta</button><button data-k="one" data-r="${r.id}">×1</button>
        <button class="primary" style="margin-left:auto" data-addr="${r.id}">Aggiungi</button></div>
      <button class="linkbtn" data-editr="${r.id}">Modifica</button></div>`};
  const draw=()=>{const R=rem();
    if(view==='list'){const rs=recipes();
      box.innerHTML=`<div class="head"><div><h2>Completa la giornata</h2><div class="small muted num">Mancano ${fmt(Math.max(0,R.kcal))} kcal · P ${fmt(Math.max(0,R.prot))} · C ${fmt(Math.max(0,R.carb))} · G ${fmt(Math.max(0,R.fat))}</div></div><button class="ghost" data-x="close">Chiudi</button></div>
       ${rs.length?`<div class="label">Aggiungi a</div><div class="seg">${MEALS.map(m=>`<button class="${m===meal?'on':''}" data-m="${m}">${m}</button>`).join('')}</div>
         <div class="hint">Le tue combinazioni, scalate tutte insieme nelle tue proporzioni fino alle calorie che mancano.</div>${rs.map(card).join('')}`
        :`<div class="empty">Salva le combinazioni che mangi davvero (es. proteine 30 g + muesli 50 g + latte 300 g) con le tue dosi tipiche: qui le scalo in proporzione per chiudere la giornata.</div>`}
       <button class="${rs.length?'':'primary'}" data-x="new">+ Nuova combinazione</button>
       <button class="linkbtn" data-x="free">Proposta automatica con alimenti liberi ›</button>`}
    else{const used=MEALS.filter(m=>entries().some(e=>e.meal===m));const hits=q?match(norm(q),8).filter(f=>!ed.items.some(i=>i.foodId===f.id)):[];
      box.innerHTML=`<div class="head"><h2>${ed.id?'Modifica combinazione':'Nuova combinazione'}</h2><button class="ghost" data-x="list">Indietro</button></div>
       <label>Nome<input id="rn" value="${esc(ed.name)}" placeholder="Spuntino notte"></label>
       ${used.length?`<div class="label">Prendi da un pasto di ${dateLabel(S.date).toLowerCase()}</div><div class="hscroll">${used.map(m=>`<button class="chip" data-from="${m}">${m}</button>`).join('')}</div>`:''}
       <div class="label">Alimenti e dose tipica</div>
       ${ed.items.length?ed.items.map((i,j)=>{const f=food(i.foodId);return `<div class="ln" style="display:flex;gap:8px;align-items:center"><span style="flex:1;min-width:0">${esc(f?f.name:'(eliminato)')}</span><input data-gi="${j}" inputmode="numeric" value="${i.g}" style="width:78px;text-align:right"><span class="muted small">g</span><button class="ghost" data-del="${j}" aria-label="Togli">✕</button></div>`}).join(''):'<div class="hint">Nessun alimento: cercane uno qui sotto.</div>'}
       <input id="rq" type="search" placeholder="Aggiungi alimento dal tuo archivio" value="${esc(q)}">
       ${hits.map(f=>`<button class="pick" data-addf="${f.id}"><span>${esc(f.name)}</span><span class="muted small">${f.lastGrams?f.lastGrams+' g':''}</span></button>`).join('')}
       <div class="foot" style="display:flex;flex-direction:column;gap:8px"><button class="primary big" data-x="save">Salva</button>${ed.id?'<button class="danger" data-x="delr">Elimina combinazione</button>':''}</div>`;
      const rq=box.querySelector('#rq');if(rq&&q){rq.focus();rq.setSelectionRange(q.length,q.length)}}};
  draw();
  v.addEventListener('input',e=>{if(e.target.id==='rq'){q=e.target.value;draw()}else if(e.target.id==='rn'){ed.name=e.target.value}else if(e.target.dataset.gi!=null){ed.items[+e.target.dataset.gi].g=Math.max(0,Math.round(num(e.target.value)))}});
  v.addEventListener('click',e=>{if(e.target===v){v.remove();return}const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.m){meal=d.m;draw();return}
    if(d.k){const r=recipes().find(x=>x.id===d.r);const k=K[d.r]??1;K[d.r]=d.k==='+'?Math.min(3,k+.1):d.k==='-'?Math.max(.1,k-.1):d.k==='one'?1:fitK(r,rem().kcal);K[d.r]=Math.round(K[d.r]*100)/100;draw();return}
    if(d.addr){const r=recipes().find(x=>x.id===d.addr);const {items}=scaleRecipe(r,K[r.id]??1);addEntries(items.map(i=>({food:i.food,grams:i.grams,meal})));S.meal=meal;S.mealT=Date.now();v.remove();toast(`${r.name} aggiunto a ${meal}`);return}
    if(d.editr){const r=recipes().find(x=>x.id===d.editr);ed={id:r.id,name:r.name,items:r.items.map(i=>({...i}))};q='';view='edit';draw();return}
    if(d.from){ed.items=entries().filter(x=>x.meal===d.from&&D.foods[x.foodId]).map(x=>({foodId:x.foodId,g:x.grams}));if(!ed.name)ed.name=d.from.charAt(0).toUpperCase()+d.from.slice(1);draw();return}
    if(d.addf){const f=food(d.addf);ed.items.push({foodId:f.id,g:f.lastGrams||f.unit?.grams||100});q='';draw();return}
    if(d.del!=null){ed.items.splice(+d.del,1);draw();return}
    const x=d.x;if(x==='close')v.remove();if(x==='free'){v.remove();openComboFree()}
    if(x==='new'){ed={id:null,name:'',items:[]};q='';view='edit';draw()}
    if(x==='list'){view='list';draw()}
    if(x==='save'){ed.items=ed.items.filter(i=>i.g>0&&D.foods[i.foodId]);if(!ed.items.length){toast('Aggiungi almeno un alimento');return}
      const r={id:ed.id||uid(),name:(ed.name||'Combinazione').trim(),items:ed.items};const rs=recipes();const ix=rs.findIndex(y=>y.id===r.id);ix>=0?rs[ix]=r:rs.push(r);delete K[r.id];save();view='list';draw();toast('Combinazione salvata')}
    if(x==='delr'){D.recipes=recipes().filter(y=>y.id!==ed.id);save();view='list';draw();toast('Combinazione eliminata')}})}

// ================= Alimenti =================
function renderArchive(){const q=norm(S.fq);let list=foods();
  list=q?list.map(f=>({f,s:scoreFood(f,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.f):list.sort(byUse);
  lastRes={};const db=q?matchDb(q,8):[];
  $('flist').innerHTML=`<div class="list">${list.map(f=>`<button class="res" data-act="card" data-id="${f.id}"><span class="rn">${esc(f.name)}${f.brand?`<br><span class="rs">${esc(f.brand)}</span>`:''}</span><span class="rk num">${fmt(f.per100?.kcal)} kcal</span></button>`).join('')||`<div class="empty">Nessun alimento${q?' trovato':''}.</div>`}</div>
   ${db.length?`<div class="sec" style="margin-top:14px"><div class="label">Alimenti comuni</div><div class="list">${db.map(resBtn).join('')}</div></div>`:''}
   <p class="hint" style="margin-top:12px">${Object.keys(D.foods).length} alimenti salvati. Tocca per modificarli.</p>`}
function openFoodSheet(f,opts={}){const isNew=!f||!f.id||!D.foods[f.id];f=f||{};
  const v=sheet(`<div class="head"><h2>${isNew?'Nuovo alimento':esc(f.name)}</h2><button class="ghost" data-x="close">Chiudi</button></div>
   ${opts.note?`<div class="banner">${opts.note}</div>`:''}
   <label class="grid2" style="grid-template-columns:1fr"><span class="small muted">Nome</span><input id="f_name" value="${esc(f.name||'')}"></label>
   <div class="label">Valori per 100 g (dall’etichetta)</div>
   <div class="grid2">${[['kcal','Kcal'],['prot','Proteine g'],['carb','Carboidrati g'],['fat','Grassi g']].map(([k,l])=>`<label>${l}<input id="f_${k}" inputmode="decimal" value="${f.per100?.[k]??''}"></label>`).join('')}</div>
   <details><summary>Altri dettagli (marca, EAN, pezzo, zuccheri, sale…) ›</summary><div class="grid2" style="margin-top:10px">
    <label>Marca<input id="f_brand" value="${esc(f.brand||'')}"></label><label>EAN<input id="f_ean" inputmode="numeric" value="${esc(f.ean||'')}"></label>
    <label>Pezzo (es. vasetto)<input id="f_un" value="${esc(f.unit?.name||'')}"></label><label>Grammi per pezzo<input id="f_ug" inputmode="decimal" value="${esc(f.unit?.grams||'')}"></label>
    <label>Soprannomi<input id="f_al" value="${esc((f.aliases||[]).join(', '))}"></label>
    ${[['sug','Zuccheri g'],['sat','Saturi g'],['fib','Fibre g'],['salt','Sale g']].map(([k,l])=>`<label>${l}<input id="f_${k}" inputmode="decimal" value="${f.per100?.[k]??''}"></label>`).join('')}
    ${MIC.map(x=>`<label>${x.l} ${x.u}<input id="f_m_${x.k}" inputmode="decimal" value="${f.micro?.[x.k]??''}"></label>`).join('')}</div></details>
   <button class="primary big" data-x="save">${isNew?'Salva e scegli i grammi':'Salva'}</button>
   ${!isNew?`<button data-x="log">Aggiungi al diario</button><button class="danger" data-x="del">Elimina dall’archivio</button>`:''}`);
  const val=id=>v.querySelector('#'+id)?.value??'';if(isNew&&!f.name)setTimeout(()=>v.querySelector('#f_name')?.focus(),60);
  v.addEventListener('click',ev=>{if(ev.target===v){v.remove();return}const x=ev.target.closest('[data-x]')?.dataset.x;if(!x)return;
    if(x==='close')v.remove();if(x==='log'){v.remove();openQty(food(f.id))}
    if(x==='del'){if(ev.target.dataset.sure){delete D.foods[f.id];save();v.remove();renderAll();toast('Eliminato')}else{ev.target.dataset.sure=1;ev.target.textContent='Tocca di nuovo per confermare'}}
    if(x==='save'){const name=val('f_name').trim();if(!name){toast('Serve un nome');return}
      const per100={};LBL.forEach(l=>per100[l.k]=num(val('f_'+l.k)));if(!per100.kcal&&(per100.prot||per100.carb||per100.fat))per100.kcal=Math.round(per100.prot*4+per100.carb*4+per100.fat*9);
      if(!per100.kcal){toast('Inserisci almeno le kcal');return}
      const micro={};MIC.forEach(m=>{const s=val('f_m_'+m.k);if(s!=='')micro[m.k]=num(s)});const ug=num(val('f_ug')),un=val('f_un').trim();const id=(!isNew&&f.id)||uid();
      D.foods[id]={...(D.foods[id]||{}),name,brand:val('f_brand').trim()||null,ean:val('f_ean').replace(/\D/g,'')||null,aliases:val('f_al').split(',').map(s=>s.trim()).filter(Boolean),
        unit:un&&ug?{name:un,grams:ug}:null,per100,micro,source:f.source||'etichetta',created:f.created||Date.now(),uses:f.uses||0};
      save();v.remove();renderAll();if(isNew){clearSearch();openQty(food(id))}else toast('Salvato')}})}

// ================= Open Food Facts =================
function mapOff(p){const n=p.nutriments||{};const g=k=>n[k+'_100g']!=null&&n[k+'_100g']!==''?Number(n[k+'_100g']):null;
  let kcal=g('energy-kcal');if(kcal==null&&g('energy')!=null)kcal=g('energy')/4.184;if(kcal==null)return null;
  const per100={kcal:Math.round(kcal),prot:g('proteins')??0,carb:g('carbohydrates')??0,sug:g('sugars')??0,fat:g('fat')??0,sat:g('saturated-fat')??0,fib:g('fiber')??0,salt:g('salt')??0};
  for(const k in per100)per100[k]=Math.round(per100[k]*10)/10;
  const micro={};const mm=(k,key,f)=>{const v=g(key);if(v!=null)micro[k]=+(v*f).toFixed(3)};
  mm('k','potassium',1000);mm('ca','calcium',1000);mm('mg','magnesium',1000);mm('fe','iron',1000);mm('zn','zinc',1000);mm('vita','vitamin-a',1e6);
  mm('vitc','vitamin-c',1000);mm('vitd','vitamin-d',1e6);mm('vite','vitamin-e',1000);mm('b12','vitamin-b12',1e6);mm('fol','vitamin-b9',1e6);
  const name=p.product_name_it||p.product_name||p.product_name_en||p.product_name_de||p.product_name_fr||'';if(!name)return null;const sq=Number(p.serving_quantity)||0;
  return {id:'off:'+(p.code||uid()),name,brand:(p.brands||'').split(',')[0].trim()||null,ean:p.code||null,aliases:[],unit:sq>0?{name:'porzione',grams:Math.round(sq)}:null,per100,micro,source:'off'}}
const OFF_F='code,product_name,product_name_it,product_name_de,product_name_fr,product_name_en,brands,serving_quantity,nutriments';
async function offLookup(ean){const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=${OFF_F}`,{cache:'no-store'});if(!r.ok)throw 0;
  const j=await r.json();return j.status===1&&j.product?mapOff({...j.product,code:ean}):null}
async function offSearch(q){const r=await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${OFF_F}`,{cache:'no-store'});
  if(!r.ok)throw 0;const j=await r.json();return (j.products||[]).map(mapOff).filter(Boolean).slice(0,12)}
async function runOnline(){const text=$('q').value.trim();S.onlineBusy=true;renderResults();
  try{S.online=await offSearch(text);S.onlineQ=norm(text)}catch(e){toast('Ricerca non riuscita, riprova')}S.onlineBusy=false;renderResults()}
async function handleEan(ean){ean=String(ean).replace(/\D/g,'');const local=foods().find(f=>f.ean===ean);if(local){openQty(local);return}
  if(!navigator.onLine){openFoodSheet({ean},{note:`Codice ${ean}. Sei offline: inserisci i valori dall’etichetta.`});return}
  toast('Cerco il prodotto…');
  try{const f=await offLookup(ean);if(f){clearSearch();openQty(f)}else openFoodSheet({ean},{note:`Codice ${ean} non trovato online: inserisci i valori dall’etichetta.`})}
  catch(e){openFoodSheet({ean},{note:'Ricerca non riuscita: inserisci i valori dall’etichetta.'})}}

// ================= scanner (ZXing WebAssembly) =================
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.append(s)})}
let zxP=null;function zxing(){if(!zxP)zxP=loadScript('vendor/zxing-reader.js').then(()=>{ZXingWASM.prepareZXingModule({overrides:{locateFile:(p,pre)=>p.endsWith('.wasm')?new URL('vendor/zxing_reader.wasm',location.href).href:pre+p}});return ZXingWASM});return zxP}
const RO={formats:['EAN13','EAN8','UPCA','UPCE'],tryHarder:true,maxNumberOfSymbols:1};
function eanOk(c){if(!/^\d{8}$|^\d{12,13}$/.test(c))return false;const d=c.split('').map(Number);const chk=d.pop();const s=d.reverse().reduce((a,x,i)=>a+x*(i%2===0?3:1),0);return (10-s%10)%10===chk}
async function openScanner(){let stream=null,stop=false,busy=false;
  const v=sheet(`<div class="head"><h2>Codice a barre</h2><button class="ghost" data-x="close">Chiudi</button></div>
    <div class="cam" id="cam"><video id="vid" playsinline muted autoplay></video><div class="aim"></div></div>
    <div class="hint" id="smsg">Avvio la fotocamera…</div>
    <label class="primary big" style="display:flex;align-items:center;justify-content:center;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-weight:600;cursor:pointer">Scatta una foto del codice<input type="file" id="shot" accept="image/*" capture="environment" hidden></label>
    <div class="row"><input id="manEan" inputmode="numeric" placeholder="oppure scrivi il numero" class="grow"><button data-x="man">Cerca</button></div>`);
  const msg=t=>{const m=v.querySelector('#smsg');if(m)m.textContent=t};
  const close=()=>{stop=true;stream?.getTracks().forEach(t=>t.stop());v.remove()};
  const found=code=>{if(stop)return;if(navigator.vibrate)navigator.vibrate(40);close();handleEan(code)};
  v.addEventListener('click',e=>{if(e.target===v)return close();const x=e.target.closest('[data-x]')?.dataset.x;if(x==='close')close();
    if(x==='man'){const c=v.querySelector('#manEan').value.replace(/\D/g,'');if(c.length>=8)found(c);else toast('Numero non valido')}});
  v.querySelector('#shot').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;msg('Leggo la foto…');
    try{const zx=await zxing();const r=await zx.readBarcodes(file,RO);const c=r.find(x=>x.isValid&&eanOk(x.text));if(c)found(c.text);else msg('Non leggo il codice: riprova più vicino, dritto e con più luce.')}
    catch(err){msg('Non riesco a leggere la foto. Scrivi il numero sotto il codice.')}});
  zxing().catch(()=>{});
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    if(stop){stream.getTracks().forEach(t=>t.stop());return}
    const vid=v.querySelector('#vid');vid.srcObject=stream;await vid.play().catch(()=>{});msg('Inquadra il codice dentro il riquadro, a 10–15 cm.');
    const zx=await zxing();const cv=document.createElement('canvas');const ctx=cv.getContext('2d',{willReadFrequently:true});
    const loop=async()=>{if(stop)return;if(!busy&&vid.videoWidth){busy=true;try{
        const W=vid.videoWidth,H=vid.videoHeight;const cw=Math.round(W*0.9),ch=Math.round(H*0.45);const sc=Math.min(1,1280/cw);
        cv.width=Math.round(cw*sc);cv.height=Math.round(ch*sc);ctx.drawImage(vid,(W-cw)/2,(H-ch)/2,cw,ch,0,0,cv.width,cv.height);
        const r=await zx.readBarcodes(ctx.getImageData(0,0,cv.width,cv.height),RO);const c=r.find(x=>x.isValid&&eanOk(x.text));if(c){found(c.text);return}
      }catch(err){}busy=false}setTimeout(loop,180)};loop();
  }catch(err){v.querySelector('#cam').hidden=true;msg('La fotocamera dal vivo non è disponibile qui: usa “Scatta una foto del codice”.')}}

// ================= Profilo =================
function renderProfile(){const t=T(),c=D.settings?.calc||{peso:'',altezza:'',eta:23,sesso:'M',att:'1.55',obj:'mantenimento'};
  const days=[];for(let i=6;i>=0;i--){const ds=shift(todayStr(),-i);const es=D.days[ds]||[];days.push({ds,k:totals(es).kcal,n:es.length})}
  const max=Math.max(t.kcal*1.25,...days.map(d=>d.k));const logged=days.filter(d=>d.n);const avg=logged.length?logged.reduce((s,d)=>s+d.k,0)/logged.length:0;
  $('profv').innerHTML=`<section class="card"><h2>Obiettivo giornaliero</h2>
    <div class="grid2">${[['kcal','Calorie'],['prot','Proteine g'],['carb','Carboidrati g'],['fat','Grassi g']].map(([k,l])=>`<label>${l}<input id="t_${k}" inputmode="decimal" value="${t[k]}"></label>`).join('')}</div>
    <button class="primary" data-act="saveT">Salva</button>
    <details><summary>Calcolalo per me ›</summary><div class="grid2" style="margin-top:10px">
     <label>Peso kg<input id="c_peso" inputmode="decimal" value="${esc(c.peso)}"></label><label>Altezza cm<input id="c_altezza" inputmode="decimal" value="${esc(c.altezza)}"></label>
     <label>Età<input id="c_eta" inputmode="numeric" value="${esc(c.eta)}"></label>
     <label>Sesso<select id="c_sesso"><option value="M" ${c.sesso==='M'?'selected':''}>Uomo</option><option value="F" ${c.sesso==='F'?'selected':''}>Donna</option></select></label>
     <label>Attività<select id="c_att">${[['1.2','Sedentario'],['1.375','Leggera'],['1.55','Moderata'],['1.725','Alta'],['1.9','Molto alta']].map(([x,l])=>`<option value="${x}" ${String(c.att)===x?'selected':''}>${l}</option>`).join('')}</select></label>
     <label>Obiettivo<select id="c_obj">${['definizione','mantenimento','massa'].map(o=>`<option ${o===c.obj?'selected':''}>${o}</option>`).join('')}</select></label></div>
     <button style="margin-top:10px" data-act="calc">Calcola e applica</button></details></section>
   <section class="card"><h2>Giorni di allenamento</h2>${(()=>{const c=trainCfg();return `
    <label class="ck small"><input type="checkbox" id="tr_on" ${c.on?'checked':''}> Obiettivo diverso nei giorni di allenamento</label>
    <div class="grid2"><label>Allenamento: kcal in più<input id="tr_plus" inputmode="numeric" value="${c.plus}"></label><label>Riposo: kcal in meno<input id="tr_minus" inputmode="numeric" value="${c.minus}"></label></div>
    <button data-act="saveTr">Salva</button>
    <div class="label">Giorni fissi (se non usi Hevy)</div><div class="wdrow">${WD.map((l,i)=>`<button class="chip ${c.days.includes(i)?'on':''}" data-act="trday" data-i="${i}" aria-label="giorno ${i+1}">${l}</button>`).join('')}</div>
    <div class="hint">La differenza va tutta sui carboidrati. Per decidere se è un giorno di allenamento conta prima la tua scelta su Oggi, poi Hevy (lo legge «Sincronizza con Salute»), poi questi giorni fissi.</div>`})()}</section>
   <section class="card"><h2>Peso</h2>
    <div class="row"><input id="w_kg" inputmode="decimal" placeholder="kg" value="${esc(D.weights?.[todayStr()]??'')}" style="width:110px"><button class="primary" data-act="saveW">Salva peso di oggi</button></div>
    ${wSpark()}<div class="hint">Pesati al mattino, a digiuno, 3–4 volte a settimana. Conta l'andamento, non il singolo giorno.</div></section>
   <section class="card"><h2>Fabbisogno reale</h2>${(()=>{const e=tdeeEst();return e.ok?`
    <div>Stima: <b class="num">${fmt(e.tdee)} kcal</b> al giorno</div>
    <div class="hint">Media mangiata ${fmt(e.intake)} kcal su ${e.days} giorni · peso ${e.kgw>=0?'+':'−'}${fmt(Math.abs(e.kgw),2)} kg a settimana</div>
    <div>Per «${esc(e.obj)}»: obiettivo base <b class="num">${fmt(e.base)} kcal</b>${trainCfg().on?` <span class="small muted">(con i giorni di allenamento la media è ${fmt(e.target)})</span>`:''}</div>
    <button class="primary" data-act="applyT" ${Math.abs(e.base-T().kcal)<10?'disabled':''}>${Math.abs(e.base-T().kcal)<10?'Già applicato':`Applica (ora ${fmt(T().kcal)})`}</button>`
    :`<div class="hint">${e.weird?'I dati danno una stima fuori scala: controlla di aver registrato giornate intere e pesi corretti.':`Servono almeno 4 pesate distribuite su 14 giorni e 10 giorni registrati per intero nelle ultime 4 settimane. Ora: ${e.ws} pesate su ${Math.round(e.span)} giorni, ${e.days} giorni registrati.`}</div>`})()}
    <label class="ck small"><input type="checkbox" id="autoT" ${D.settings?.autoTdee?'checked':''}> Aggiorna l'obiettivo da solo ogni lunedì</label>
    <div class="hint">Fabbisogno = media mangiata − variazione di peso (7.700 kcal per kg). I giorni sotto metà obiettivo non contano, perché di solito sono registrati a metà. L'obiettivo «${esc(D.settings?.calc?.obj||'mantenimento')}» si cambia in «Calcolalo per me». Cambiano i carboidrati, non proteine e grassi.</div></section>
   <section class="card"><h2>Saldo settimanale</h2>
    <div class="hint">Da lunedì a ieri hai mangiato <b class="num">${(()=>{const B=weekBal(todayStr());return (B>0?'+':B<0?'−':'')+fmt(Math.abs(B))})()} kcal</b> rispetto all'obiettivo (contano solo i giorni registrati). Lo sforamento viene tolto dall'obiettivo del giorno dopo, al massimo il 30% al giorno; il resto slitta ai giorni seguenti. Il lunedì si riparte da zero.</div>
    <div class="seg three" id="carryseg">${[['off','Spento'],['over','Sforamenti'],['both','Anche avanzi']].map(([k,l])=>`<button class="${carryMode()===k?'on':''}" data-act="carry" data-mode="${k}">${l}</button>`).join('')}</div>
    <div class="hint">«Anche avanzi»: se un giorno mangi meno, il giorno dopo hai quelle calorie in più.</div></section>
   <section class="card"><h2>Ultimi 7 giorni</h2><div class="week"><div class="tline" style="bottom:${(t.kcal/max)*120+28}px"></div>
    ${days.map(d=>`<div class="wk"><div class="v num">${d.n?fmt(d.k):''}</div><div class="b ${d.k>t.kcal*1.08?'o':''}" style="height:${(d.k/max)*120}px"></div><div class="l">${new Date(d.ds+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'})}</div></div>`).join('')}</div>
    <div class="small muted">Media ${fmt(avg)} kcal sui ${logged.length} giorni registrati · tratteggio = obiettivo</div></section>
   <section class="card"><h2>Collegamento con Salute</h2>
    <div class="hint">Il pulsante «Sincronizza con Salute» avvia il Comando Rapido qui sotto: scrive in Salute calorie e macro aggiunti dall'ultimo invio e legge le calorie spese oggi dal Fitbit.</div>
    <label>Nome del Comando Rapido<input id="sc_name" value="${esc(scName())}"></label><button data-act="saveSC">Salva nome</button>
    <details><summary>Come creare il Comando Rapido ›</summary><ol class="small" style="padding-left:1.2em;margin:10px 0 0;display:flex;flex-direction:column;gap:6px">
     <li>Comandi Rapidi → <b>+</b> → rinominalo esattamente <b>${esc(scName())}</b>.</li>
     <li><b>Ottieni dizionario da</b> → Input comando rapido.</li>
     <li><b>Ottieni valore dizionario</b> per la chiave <b>when</b> → poi <b>Ottieni date da</b> quel valore. Rinomina la variabile in <i>Quando</i>.</li>
     <li><b>Ottieni valore dizionario</b> per <b>log</b> → <b>Se</b> il valore <b>è</b> 1:</li>
     <li style="margin-left:1em">Dentro il «Se», 4 volte: <b>Ottieni valore dizionario</b> (kcal / prot / carb / fat) → <b>Registra campione di salute</b>: Energia alimentare (kcal) · Proteine (g) · Carboidrati (g) · Grassi totali (g); Valore = il valore appena letto; Data = <i>Quando</i>. Chiudi il «Se».</li>
     <li><b>Trova campioni di salute</b>: Tipo <b>Energia attiva</b>, Data di inizio <b>è oggi</b>, Fonte <b>è Google Health</b>, Raggruppa per <b>Giorno</b> → <b>Ottieni dettagli dei campioni di salute</b>: Valore. Rinomina in <i>Attive</i>.</li>
     <li>Uguale con <b>Energia a riposo</b> → rinomina in <i>Riposo</i>.</li>
     <li><b>Trova campioni di salute</b>: Tipo <b>Energia attiva</b>, Data di inizio <b>è oggi</b>, Fonte <b>è Hevy</b> → <b>Conta</b> gli elementi. Rinomina in <i>Hevy</i> (serve a riconoscere i giorni di allenamento).</li>
     <li>Facoltativo, se una bilancia scrive in Salute: <b>Trova campioni di salute</b>: Tipo <b>Peso corporeo</b>, Ordina per <b>Data di inizio</b>, <b>Dal più recente</b>, Limite <b>1</b> → <b>Ottieni dettagli</b>: Valore. Rinomina in <i>Peso</i>.</li>
     <li><b>Testo</b>: <span class="num">DMSYNC|</span>[valore dizionario <b>id</b>]<span class="num">|</span>[<i>Attive</i>]<span class="num">|</span>[<i>Riposo</i>]<span class="num">|</span>[<i>Hevy</i>]<span class="num">|</span>[<i>Peso</i>] → <b>Copia negli appunti</b>. Senza bilancia lascia vuoto l'ultimo campo.</li>
     <li>Primo avvio: concedi a Comandi Rapidi lettura e scrittura in Salute.</li></ol></details></section>
   <section class="card"><h2>Backup</h2><div class="hint">I dati stanno solo su questo telefono. Esporta un backup ogni tanto.</div>
    <div class="row"><button data-act="export">Esporta</button><label class="chip" style="cursor:pointer">Importa<input type="file" id="imp" accept="application/json,.json" hidden></label></div>
    <div class="hint">${Object.keys(D.foods).length} alimenti · ${Object.keys(D.days).length} giorni · versione 4</div></section>`}
async function exportBackup(){const blob=new Blob([JSON.stringify({app:'diario-macro',v:1,exported:new Date().toISOString(),...D})],{type:'application/json'});
  const name=`diario-macro-${todayStr()}.json`;const file=new File([blob],name,{type:'application/json'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){if(e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function importBackup(file){const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);if(!j.foods||!j.days)throw 0;
    const v=sheet(`<h2>Importa backup</h2><p class="small">${Object.keys(j.foods).length} alimenti e ${Object.keys(j.days).length} giorni.</p>
     <button class="primary" data-x="merge">Unisci ai dati attuali</button><button class="danger" data-x="replace">Sostituisci tutto</button><button class="ghost" data-x="close">Annulla</button>`);
    v.addEventListener('click',ev=>{const x=ev.target.closest('[data-x]')?.dataset.x;if(!x&&ev.target!==v)return;
      if(x==='merge'){Object.assign(D.foods,j.foods);for(const ds in j.days){const ids=new Set((D.days[ds]||[]).map(e=>e.id));D.days[ds]=[...(D.days[ds]||[]),...j.days[ds].filter(e=>!ids.has(e.id))]}if(j.settings&&!D.settings)D.settings=j.settings;D.weights={...(j.weights||{}),...(D.weights||{})};D.dayType={...(j.dayType||{}),...(D.dayType||{})};if(j.recipes){const ids=new Set(recipes().map(r=>r.id));j.recipes.forEach(r=>{if(!ids.has(r.id))recipes().push(r)})}toast('Backup unito')}
      if(x==='replace'){D={foods:j.foods,days:j.days,settings:j.settings||null,recipes:j.recipes||[],health:j.health||null,weights:j.weights||{},dayType:j.dayType||{},created:j.created||Date.now()};toast('Backup ripristinato')}
      saveNow();v.remove();renderAll()})}catch(e){toast('File non valido')}};r.readAsText(file)}

// ================= eventi =================
let resT;$('q').addEventListener('input',()=>{S.online=null;clearTimeout(resT);resT=setTimeout(renderResults,70)});
$('q').addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const t=$('q').value.trim();if(!t)return;
  if(isEan(t))return handleEan(t);const b=document.querySelector('#results [data-act=logAll],#results .res');if(b)b.click()});
$('clearQ').onclick=()=>{clearSearch();$('q').focus()};
$('scanBtn').onclick=openScanner;$('scanBtn2').onclick=openScanner;$('newFood').onclick=()=>openFoodSheet(null);
$('fq').addEventListener('input',e=>{S.fq=e.target.value;renderArchive()});
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;S.tab=b.dataset.tab;renderAll();window.scrollTo(0,0)});
$('prevDay').onclick=()=>{S.date=shift(S.date,-1);renderAll()};
$('nextDay').onclick=()=>{if(S.date<todayStr()){S.date=shift(S.date,1);renderAll()}};
window.addEventListener('online',renderResults);window.addEventListener('offline',renderResults);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(S._today&&S.date===S._today&&S.date!==todayStr())S.date=todayStr();S._today=todayStr();renderAll()}});S._today=todayStr();
document.body.addEventListener('change',e=>{if(e.target.id==='imp'&&e.target.files?.[0]){importBackup(e.target.files[0]);e.target.value=''}
  if(e.target.id==='tr_on'){D.settings={...(D.settings||{}),train:{...trainCfg(),on:e.target.checked}};save();renderProfile()}
  if(e.target.id==='autoT'){D.settings={...(D.settings||{}),autoTdee:e.target.checked};save();toast(e.target.checked?'Aggiornamento automatico attivo':'Aggiornamento automatico spento')}});
document.body.addEventListener('click',e=>{if(e.target.closest('.veil'))return;
  const pk=e.target.closest('[data-pick]');if(pk){const f=lastRes[pk.dataset.pick]||food(pk.dataset.pick);if(f)openQty(f);return}
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='qty'){const f=food(b.dataset.food);if(f)openQty(f)}
  if(a==='edit'){const en=entries().find(x=>x.id===b.dataset.id);if(en)openQty({...(food(en.foodId)||{}),name:en.name,brand:en.brand,per100:en.per100},{entry:en})}
  if(a==='logAll'){const ok=parseText($('q').value).filter(i=>i.food&&i.grams>0);addEntries(ok.map(i=>({food:i.food,grams:i.grams,meal:curMeal()})));clearSearch();toast(`Aggiunti ${ok.length} alimenti`)}
  if(a==='online')runOnline();
  if(a==='ean')handleEan(b.dataset.ean);
  if(a==='create'){const n=b.dataset.name||'';openFoodSheet({name:n.charAt(0).toUpperCase()+n.slice(1),aliases:n?[n.toLowerCase()]:[]})}
  if(a==='combo')openCombo();
  if(a==='card')openFoodSheet(food(b.dataset.id));
  if(a==='saveT'){const tg={...T()};['kcal','prot','carb','fat'].forEach(k=>tg[k]=num($('t_'+k).value));D.settings={...(D.settings||{}),targets:tg};save();toast('Obiettivo salvato')}
  if(a==='calc'){const v=id=>$(id).value;const peso=num(v('c_peso')),alt=num(v('c_altezza')),eta=num(v('c_eta')),sesso=v('c_sesso'),att=num(v('c_att')),obj=v('c_obj');
    if(!peso||!alt||!eta){toast('Inserisci peso, altezza ed età');return}
    const bmr=10*peso+6.25*alt-5*eta+(sesso==='M'?5:-161);const kcal=Math.round(bmr*att*(obj==='definizione'?.85:obj==='massa'?1.1:1)/10)*10;
    const prot=Math.round(peso*(obj==='definizione'?2:1.8)),fat=Math.round(peso*.9),carb=Math.max(0,Math.round((kcal-prot*4-fat*9)/4));
    D.settings={...(D.settings||{}),targets:{...T(),kcal,prot,carb,fat},calc:{peso,altezza:alt,eta,sesso,att:String(att),obj}};save();renderProfile();toast(`Nuovo obiettivo: ${fmt(kcal)} kcal`)}
  if(a==='export')exportBackup();
  if(a==='carry'){D.settings={...(D.settings||{}),carry:b.dataset.mode};save();renderProfile();toast('Saldo settimanale aggiornato')}
  if(a==='addto'){S.meal=b.dataset.meal;S.mealT=Date.now();$('q').placeholder=`Cosa hai mangiato a ${S.meal}?`;window.scrollTo({top:0,behavior:'smooth'});$('q').focus()}
  if(a==='ttoggle'){D.dayType=D.dayType||{};D.dayType[S.date]=trainInfo(S.date).train?'rest':'train';save();renderAll()}
  if(a==='trday'){const c=trainCfg(),i=+b.dataset.i;const days=c.days.includes(i)?c.days.filter(x=>x!==i):[...c.days,i].sort();D.settings={...(D.settings||{}),train:{...c,days}};save();renderProfile()}
  if(a==='saveTr'){const c=trainCfg();D.settings={...(D.settings||{}),train:{...c,plus:Math.max(0,Math.round(num($('tr_plus').value))),minus:Math.max(0,Math.round(num($('tr_minus').value)))}};save();renderProfile();toast('Salvato')}
  if(a==='saveW'){const w=num($('w_kg').value);if(w<30||w>250){toast('Peso non valido');return}D.weights=D.weights||{};D.weights[todayStr()]=Math.round(w*10)/10;save();renderProfile();toast('Peso salvato')}
  if(a==='applyT'){const e=tdeeEst();if(e.ok){applyTdee(e);renderProfile();toast(`Obiettivo base: ${fmt(e.base)} kcal`)}}
  if(a==='hsync')syncHealth();
  if(a==='hpaste')pasteHealth();
  if(a==='hburn')manualBurn();
  if(a==='saveSC'){D.settings={...(D.settings||{}),shortcut:$('sc_name').value.trim()||SC_DEF};save();renderProfile();toast('Nome salvato')}
});

if('serviceWorker' in navigator&&location.protocol!=='file:'){const had=!!navigator.serviceWorker.controller;let rl=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had&&!rl){rl=true;saveNow();location.reload()}});
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{document.addEventListener('visibilitychange',()=>{if(!document.hidden)r.update().catch(()=>{})})}).catch(()=>{})}
try{if(D.settings?.autoTdee){const td=todayStr();if(wdIdx(td)===0&&D.settings.tdeeApplied!==td){const e=tdeeEst();if(e.ok&&Math.abs(e.base-T().kcal)>=50){applyTdee(e);setTimeout(()=>toast(`Obiettivo aggiornato: ${fmt(e.base)} kcal`),800)}else D.settings.tdeeApplied=td}}}catch(e){}
save();renderAll();
window.DM={parseText,combos,D:()=>D,S,remaining,foods,eanOk,tdeeEst,Tday,planned,trainInfo};
})();
