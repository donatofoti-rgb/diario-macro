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
function autoMeal(){const d=new Date(),h=d.getHours()+d.getMinutes()/60;return h<11?'colazione':h<15?'pranzo':h<18.5?'spuntino':'cena'}
function dateLabel(ds){const t=todayStr();if(ds===t)return 'Oggi';if(ds===shift(t,-1))return 'Ieri';
  return new Date(ds+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}
let toastT;function toast(m){document.querySelector('.toast')?.remove();const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);clearTimeout(toastT);toastT=setTimeout(()=>d.remove(),2400)}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function foods(){return Object.entries(D.foods).map(([id,f])=>({id,...f}))}
function food(id){const f=D.foods[id];return f?{id,...f}:null}
function entries(ds=S.date){return D.days[ds]||[]}
function remaining(){const t=totals(entries()),g=T();return {kcal:g.kcal-t.kcal,prot:g.prot-t.prot,carb:g.carb-t.carb,fat:g.fat-t.fat}}
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
function openQty(f,opt={}){const edit=opt.entry;let meal=edit?edit.meal:(S.meal||autoMeal());
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
      S.meal=meal;addEntries([{food:f,grams:g,meal}]);v.remove();clearSearch();toast(`${f.name} · ${g} g aggiunto`)}})}

// ================= Oggi =================
function renderAll(){$('dateLabel').textContent=dateLabel(S.date);$('nextDay').disabled=S.date>=todayStr();
  $('datenav').style.visibility=S.tab==='oggi'?'visible':'hidden';$('title').textContent=S.tab==='oggi'?'Diario':S.tab==='alimenti'?'Alimenti':'Profilo';
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));
  ['oggi','alimenti','profilo'].forEach(t=>{$('p-'+t).hidden=t!==S.tab;$('p-'+t).style.display=t===S.tab?'flex':'none'});
  if(S.tab==='oggi'){renderSummary();renderResults();renderRecent();renderMeals()}
  if(S.tab==='alimenti')renderArchive();if(S.tab==='profilo')renderProfile()}
function renderSummary(){const t=totals(entries()),g=T();const left=g.kcal-t.kcal;
  const mb=(l,v,tg,c)=>`<div class="mac"><div class="t">${l}</div><div class="v num">${fmt(v)}<span class="muted small"> / ${fmt(tg)} g</span></div><div class="track"><div class="fill" style="width:${Math.min(100,v/tg*100)}%;background:${v>tg*1.08?'var(--warn)':c}"></div></div></div>`;
  $('summary').innerHTML=`<section class="card hero">
   <div class="row between"><div><div class="small muted">${left>=0?'Ti restano':'Sei oltre di'}</div><div class="left ${left<0?'over':''}"><span class="n num">${fmt(Math.abs(left))}</span><span class="muted">kcal</span></div></div>
    <div class="small muted num" style="text-align:right">${fmt(t.kcal)} mangiate<br>obiettivo ${fmt(g.kcal)}</div></div>
   <div class="track"><div class="fill" style="width:${Math.min(100,t.kcal/g.kcal*100)}%;${left<0?'background:var(--warn)':''}"></div></div>
   <div class="macros">${mb('Proteine',t.prot,g.prot,'var(--p)')}${mb('Carboidrati',t.carb,g.carb,'var(--c)')}${mb('Grassi',t.fat,g.fat,'var(--f)')}</div>
   ${left>30?`<button class="primary" data-act="combo">Completa la giornata</button>`:''}</section>`}

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
function renderMeals(){const es=entries();
  if(!es.length){$('meals').innerHTML=`<section class="card" style="margin-top:14px"><div class="empty">Ancora niente per ${dateLabel(S.date).toLowerCase()}. Cerca un alimento qui sopra o tocca uno dei veloci.</div></section>`;return}
  const t=totals(es),g=T();
  $('meals').innerHTML=`<section class="card" style="margin-top:14px">${MEALS.map(m=>{const list=es.filter(e=>e.meal===m);if(!list.length)return '';
   return `<div class="meal"><h3><span>${m}</span><span class="num">${fmt(totals(list).kcal)} kcal</span></h3>${list.map(e=>`<div class="it" data-act="edit" data-id="${e.id}"><span class="nm">${esc(e.name)} <span class="g num">${fmt(e.grams)} g</span></span><span class="k num">${fmt(nut(e.per100,null,e.grams).kcal)}</span></div>`).join('')}</div>`}).join('')}
   <details><summary>Fibre, sale, vitamine e minerali ›</summary><div class="micro">
    ${[['Fibre',t.fib,g.fib,'g'],['Zuccheri',t.sug,g.sug,'g',1],['Sale',t.salt,g.salt,'g',1],...MIC.map(m=>[m.l,t[m.k],m.ref,m.u])].map(([l,v,tg,u,mx])=>`<div><div class="t"><span>${l}</span><span class="num ${mx&&v>tg?'muted':''}">${fmt(v,v<10?1:0)} / ${fmt(tg,tg<10?1:0)} ${u}</span></div><div class="track"><div class="fill" style="width:${Math.min(100,v/tg*100)}%;${mx&&v>tg?'background:var(--warn)':''}"></div></div></div>`).join('')}
   </div><p class="hint">Vitamine e minerali contano solo gli alimenti che li hanno in scheda (${t._micro} su ${es.length}). Riferimenti LARN per un uomo adulto.</p></details></section>`}

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
function openCombo(){const C=S.combo;let view='pick',q='',res=null;const v=sheet('<div id="cb"></div>');const box=v.querySelector('#cb');box.style.cssText='display:flex;flex-direction:column;gap:14px';
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
    if(b.dataset.add!=null){const o=b.dataset.add==='all'?res.all:res.alt[+b.dataset.add];addEntries(o.items.map(i=>({food:i.food,grams:i.grams,meal:S.meal||autoMeal()})));v.remove();toast('Aggiunto al diario')}
    const x=b.dataset.x;if(x==='close')v.remove();if(x==='back'){view='pick';draw()}
    if(x==='calc'){res=combos(remaining(),[...C.sel].map(food).filter(Boolean),C.prio);view='res';draw();box.parentElement.scrollTop=0}})}

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
let zxP=null;function zxing(){if(!zxP)zxP=loadScript('zxing-reader.js').then(()=>{ZXingWASM.prepareZXingModule({overrides:{locateFile:(p,pre)=>p.endsWith('.wasm')?new URL('zxing_reader.wasm',location.href).href:pre+p}});return ZXingWASM});return zxP}
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
   <section class="card"><h2>Ultimi 7 giorni</h2><div class="week"><div class="tline" style="bottom:${(t.kcal/max)*120+28}px"></div>
    ${days.map(d=>`<div class="wk"><div class="v num">${d.n?fmt(d.k):''}</div><div class="b ${d.k>t.kcal*1.08?'o':''}" style="height:${(d.k/max)*120}px"></div><div class="l">${new Date(d.ds+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'})}</div></div>`).join('')}</div>
    <div class="small muted">Media ${fmt(avg)} kcal sui ${logged.length} giorni registrati · tratteggio = obiettivo</div></section>
   <section class="card"><h2>Backup</h2><div class="hint">I dati stanno solo su questo telefono. Esporta un backup ogni tanto.</div>
    <div class="row"><button data-act="export">Esporta</button><label class="chip" style="cursor:pointer">Importa<input type="file" id="imp" accept="application/json,.json" hidden></label></div>
    <div class="hint">${Object.keys(D.foods).length} alimenti · ${Object.keys(D.days).length} giorni · versione 3</div></section>`}
async function exportBackup(){const blob=new Blob([JSON.stringify({app:'diario-macro',v:1,exported:new Date().toISOString(),...D})],{type:'application/json'});
  const name=`diario-macro-${todayStr()}.json`;const file=new File([blob],name,{type:'application/json'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){if(e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function importBackup(file){const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);if(!j.foods||!j.days)throw 0;
    const v=sheet(`<h2>Importa backup</h2><p class="small">${Object.keys(j.foods).length} alimenti e ${Object.keys(j.days).length} giorni.</p>
     <button class="primary" data-x="merge">Unisci ai dati attuali</button><button class="danger" data-x="replace">Sostituisci tutto</button><button class="ghost" data-x="close">Annulla</button>`);
    v.addEventListener('click',ev=>{const x=ev.target.closest('[data-x]')?.dataset.x;if(!x&&ev.target!==v)return;
      if(x==='merge'){Object.assign(D.foods,j.foods);for(const ds in j.days){const ids=new Set((D.days[ds]||[]).map(e=>e.id));D.days[ds]=[...(D.days[ds]||[]),...j.days[ds].filter(e=>!ids.has(e.id))]}if(j.settings&&!D.settings)D.settings=j.settings;toast('Backup unito')}
      if(x==='replace'){D={foods:j.foods,days:j.days,settings:j.settings||null,created:j.created||Date.now()};toast('Backup ripristinato')}
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
document.body.addEventListener('change',e=>{if(e.target.id==='imp'&&e.target.files?.[0]){importBackup(e.target.files[0]);e.target.value=''}});
document.body.addEventListener('click',e=>{if(e.target.closest('.veil'))return;
  const pk=e.target.closest('[data-pick]');if(pk){const f=lastRes[pk.dataset.pick]||food(pk.dataset.pick);if(f)openQty(f);return}
  const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='qty'){const f=food(b.dataset.food);if(f)openQty(f)}
  if(a==='edit'){const en=entries().find(x=>x.id===b.dataset.id);if(en)openQty({...(food(en.foodId)||{}),name:en.name,brand:en.brand,per100:en.per100},{entry:en})}
  if(a==='logAll'){const ok=parseText($('q').value).filter(i=>i.food&&i.grams>0);addEntries(ok.map(i=>({food:i.food,grams:i.grams,meal:S.meal||autoMeal()})));clearSearch();toast(`Aggiunti ${ok.length} alimenti`)}
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
});

if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
save();renderAll();
window.DM={parseText,combos,D,S,remaining,foods,eanOk};
})();
