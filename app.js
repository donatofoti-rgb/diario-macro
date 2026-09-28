(() => {
'use strict';
// ================= costanti =================
const MAC=[{k:'prot',l:'Proteine',u:'g',c:'var(--p)'},{k:'carb',l:'Carboidrati',u:'g',c:'var(--c)'},{k:'fat',l:'Grassi',u:'g',c:'var(--f)'}];
const LBL=[{k:'kcal',l:'Energia',u:'kcal'},{k:'prot',l:'Proteine',u:'g'},{k:'carb',l:'Carboidrati',u:'g'},{k:'sug',l:'di cui zuccheri',u:'g'},
  {k:'fat',l:'Grassi',u:'g'},{k:'sat',l:'di cui saturi',u:'g'},{k:'fib',l:'Fibre',u:'g'},{k:'salt',l:'Sale',u:'g'}];
const MIC=[{k:'k',l:'Potassio',u:'mg',ref:3900},{k:'ca',l:'Calcio',u:'mg',ref:1000},{k:'mg',l:'Magnesio',u:'mg',ref:240},
  {k:'fe',l:'Ferro',u:'mg',ref:10},{k:'zn',l:'Zinco',u:'mg',ref:12},{k:'vita',l:'Vitamina A',u:'µg',ref:700},
  {k:'vitc',l:'Vitamina C',u:'mg',ref:105},{k:'vitd',l:'Vitamina D',u:'µg',ref:15},{k:'vite',l:'Vitamina E',u:'mg',ref:13},
  {k:'b12',l:'Vitamina B12',u:'µg',ref:2.4},{k:'fol',l:'Folati',u:'µg',ref:400}];
const MEALS=['colazione','pranzo','spuntino','cena'];
const DEF_T={kcal:2400,prot:150,carb:280,fat:75,fib:30,salt:5,sug:60};
const KEY='dm.v1';

// ================= archiviazione locale =================
function load(){try{const r=localStorage.getItem(KEY);if(r)return JSON.parse(r)}catch(e){}return null}
let D=load();
if(!D){const s=window.DM_SEED||{};D={foods:s.foods||{},days:{},settings:s.settings||null,created:Date.now()}}
let saveT;function save(){clearTimeout(saveT);saveT=setTimeout(saveNow,150)}
function saveNow(){try{localStorage.setItem(KEY,JSON.stringify(D))}catch(e){toast('Memoria piena: esporta un backup')}}
window.addEventListener('pagehide',saveNow);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveNow()});
try{navigator.storage?.persist?.()}catch(e){}

// ================= utilità =================
const $=id=>document.getElementById(id);
function todayStr(d=new Date()){const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())}
function shift(ds,n){const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+n);return todayStr(d)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function num(v){const n=Number(String(v??'').trim().replace(',','.'));return isFinite(n)?n:0}
function fmt(n,d=0){return (Number(n)||0).toLocaleString('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtAuto(n){n=Number(n)||0;if(n===0)return '0';return Math.abs(n)>=100?fmt(n):Math.abs(n)>=10?fmt(n,1):fmt(n,Math.abs(n)>=1?1:2)}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function T(){return Object.assign({},DEF_T,D.settings?.targets||{})}
function nut(per100,micro,g){const f=g/100,o={};LBL.forEach(x=>o[x.k]=num(per100?.[x.k])*f);MIC.forEach(x=>o[x.k]=micro&&micro[x.k]!=null?num(micro[x.k])*f:0);return o}
function totals(list){const t={};[...LBL,...MIC].forEach(x=>t[x.k]=0);let wm=0;
  list.forEach(e=>{const n=nut(e.per100,e.micro,e.grams);for(const k in n)t[k]+=n[k];if(e.micro&&Object.keys(e.micro).length)wm++});t._micro=wm;return t}
function autoMeal(){const d=new Date(),h=d.getHours()+d.getMinutes()/60;return h<11?'colazione':h<15?'pranzo':h<18.5?'spuntino':'cena'}
function dateLabel(ds){const t=todayStr();if(ds===t)return 'Oggi';if(ds===shift(t,-1))return 'Ieri';
  return new Date(ds+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})}
let toastT;function toast(m){document.querySelector('.toast')?.remove();const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.append(d);clearTimeout(toastT);toastT=setTimeout(()=>d.remove(),2600)}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function foods(){return Object.entries(D.foods).map(([id,f])=>({id,...f}))}
function food(id){const f=D.foods[id];return f?{id,...f}:null}
function entries(ds=S.date){return D.days[ds]||[]}

// ================= stato UI =================
const S={tab:'oggi',date:todayStr(),meal:null,over:{},openEntry:null,combo:{sel:new Set(),prio:'bilanciato',opts:null},fq:''};

// ================= parser testo → alimenti =================
const STOP=new Set(['di','del','della','dello','dei','delle','degli','d','con','il','la','lo','le','gli','i','l','un','una','uno','al','allo','alla','ai','ho','mangiato','circa','da']);
const MEALW={colazione:'colazione',pranzo:'pranzo',cena:'cena',spuntino:'spuntino',merenda:'spuntino',snack:'spuntino'};
const WNUM={mezzo:.5,mezza:.5,un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6};
const MASS={g:1,gr:1,grammi:1,grammo:1,gramm:1,kg:1000,ml:1,cl:10,dl:100,l:1000,lt:1000,litro:1000,litri:1000};
const UNITW=new Set(['pz','pezzo','pezzi','fetta','fette','vasetto','vasetti','misurino','misurini','cucchiaio','cucchiai','cucchiaino','cucchiaini','bicchiere','bicchieri','porzione','porzioni','tazza','tazze','scatoletta','scatolette','barretta','barrette','confezione','confezioni','scoop','uovo','uova','banana','banane','mela','mele']);

function lev1(a,b){ // distanza ≤1?
  if(Math.abs(a.length-b.length)>1)return false;let i=0,j=0,e=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++e>1)return false;if(a.length>b.length)i++;else if(b.length>a.length)j++;else{i++;j++}}
  return e+(a.length-i)+(b.length-j)<=1}
function scoreFood(f,q){if(!q)return 0;const qt=q.split(' ').filter(Boolean);let best=0;
  const cands=[f.name,...(f.aliases||[]),(f.brand||'')+' '+f.name,f.ean||''];
  for(const c of cands){const n=norm(c);if(!n)continue;
    if(n===q){best=Math.max(best,100);continue}
    if(n.startsWith(q+' ')||q.startsWith(n+' ')||n.startsWith(q))best=Math.max(best,82);
    const ct=n.split(' ');let hit=0;
    for(const t of qt){if(ct.some(w=>w===t||(t.length>=3&&w.startsWith(t))||(t.length>=4&&lev1(w,t))||(w.length>=4&&t.startsWith(w))))hit++}
    if(hit)best=Math.max(best,Math.round(70*hit/qt.length)-(ct.length>qt.length+2?5:0));}
  return best?best+Math.min(8,Math.log2(1+(f.uses||0))*2):0}
function match(q,n=5){return foods().map(f=>({f,s:scoreFood(f,q)})).filter(x=>x.s>=35).sort((a,b)=>b.s-a.s).slice(0,n)}

function parseChunk(raw){const dg=raw.replace(/[\s-]/g,'');if(/^\d{8,14}$/.test(dg))return {raw:raw.trim(),q:dg,n:null,mult:null,unitWord:null,meal:null};
  let s=' '+norm(raw.replace(/(\d),(\d)/g,'$1.$2').replace(/(\d)\.(\d)/g,'$1p$2'))+' ';
  s=s.replace(/(\d)p(\d)/g,'$1.$2');
  let meal=null;for(const w in MEALW){const re=new RegExp(' '+w+' ');if(re.test(s)){meal=MEALW[w];s=s.replace(re,' ')}}
  let n=null,mult=null,unitWord=null;
  const m=s.match(/ (\d+(?:\.\d+)?)\s?(kg|gr|grammi|grammo|g|ml|cl|dl|lt|l|litri|litro)? /);
  if(m){n=parseFloat(m[1]);if(m[2])mult=MASS[m[2]];s=s.replace(m[0],' ')}
  else{for(const w in WNUM){const re=new RegExp(' '+w+' ');if(re.test(s)){n=WNUM[w];s=s.replace(re,' ');break}}}
  let toks=s.trim().split(/\s+/).filter(Boolean);
  const ui=toks.findIndex(t=>UNITW.has(t)&&!['uovo','uova','banana','banane','mela','mele'].includes(t));
  if(ui>=0){unitWord=toks[ui];toks.splice(ui,1)}
  const q=toks.filter(t=>!STOP.has(t)).join(' ');
  return {raw:raw.trim(),q,n,mult,unitWord,meal}}

function resolveGrams(p,f){
  if(p.mult)return {g:Math.round(p.n*p.mult),flag:false};
  if(f.unit&&f.unit.grams){return {g:Math.round((p.n??1)*f.unit.grams),flag:false,units:(p.n??1)}}
  if(p.n!=null){if(p.n>=10)return {g:Math.round(p.n),flag:false};return {g:Math.round(p.n*100),flag:true}}
  return {g:100,flag:true}}

function parseText(text){const chunks=text.split(/,(?!\d)|(?<!\d),|[;\n+]| e (?=\d|un |una |uno |mezz|due |tre )/i).map(c=>c.trim()).filter(Boolean);
  let meal=null;const items=[];
  chunks.forEach((c,i)=>{const p=parseChunk(c);if(p.meal)meal=p.meal;if(!p.q&&!p.n)return;
    const key=i+'|'+p.raw;const ov=S.over[key]||{};
    let digits=p.q.replace(/\s/g,'');const isEan=/^\d{8,14}$/.test(digits)&&!p.mult;
    let cands=isEan?foods().filter(f=>f.ean===digits).map(f=>({f,s:100})):match(p.q);
    let f=ov.foodId?food(ov.foodId):(cands[0]?.f||null);
    let r=f?resolveGrams(p,f):{g:0,flag:false};
    const grams=ov.grams!=null?ov.grams:r.g;
    items.push({key,p,cands,food:f,grams,flag:ov.grams!=null?false:r.flag,isEan,ean:isEan?digits:null})});
  return {items,meal}}

// ================= registrazione =================
function addEntries(list){if(!list.length)return;const arr=D.days[S.date]||(D.days[S.date]=[]);
  list.forEach(({food:f,grams,meal})=>{arr.push({id:uid(),foodId:f.id,name:f.name,brand:f.brand||null,grams:Math.round(grams),meal,t:Date.now(),per100:f.per100,micro:f.micro||null,est:f.source==='stima'});
    if(D.foods[f.id]){D.foods[f.id].uses=(D.foods[f.id].uses||0)+1;D.foods[f.id].lastUsed=Date.now();
      D.foods[f.id].lastGrams=Math.round(grams)}});
  save();renderAll()}

function logFromInput(){const {items,meal}=parseText($('q').value);const ok=items.filter(i=>i.food&&i.grams>0);
  if(!ok.length){if(items.length)toast('Nessun alimento riconosciuto: crealo dall’anteprima');return}
  const m=S.meal||meal||autoMeal();addEntries(ok.map(i=>({food:i.food,grams:i.grams,meal:m})));
  const miss=items.length-ok.length;$('q').value='';S.over={};autosize();renderPreview();
  toast(`Registrati ${ok.length}`+(miss?` · ${miss} non riconosciuti`:''))}

// ================= render =================
function renderAll(){renderHeader();if(S.tab==='oggi'){renderSummary();renderMealChips();renderPreview();renderRecent();renderMeals();renderCombo();renderMicro()}
  if(S.tab==='archivio')renderArchive();if(S.tab==='settimana')renderWeek();if(S.tab==='obiettivi')renderGoals()}
function renderHeader(){$('dateLabel').textContent=dateLabel(S.date);$('nextDay').disabled=S.date>=todayStr();
  $('datenav').style.visibility=S.tab==='oggi'?'visible':'hidden';
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));
  ['oggi','archivio','settimana','obiettivi'].forEach(t=>$('p-'+t).hidden=t!==S.tab);
  const on=navigator.onLine;$('net').textContent=on?'online':'offline';}

function bar(label,val,target,color,unit,isMax){const pct=target?Math.min(100,val/target*100):0;const over=target&&val>target*(isMax?1:1.08);
  return `<div class="bar"><div class="t"><span>${label}</span><span class="num ${over?'over':''}">${fmtAuto(val)}${target?` / ${fmtAuto(target)}`:''} ${unit}</span></div>
  <div class="track"><div class="fill" style="width:${pct}%;background:${over?'var(--warn)':color}"></div></div></div>`}

function renderSummary(){const t=totals(entries()),g=T();const left=g.kcal-t.kcal;const pct=Math.min(1,t.kcal/g.kcal);const C=2*Math.PI*54;
  $('summary').innerHTML=`<section class="card">
   ${!D.settings?`<div class="banner">Obiettivi di esempio. Impostali in <b>Obiettivi</b>.</div>`:''}
   <div class="sum"><div class="ring" role="img" aria-label="${fmt(t.kcal)} kcal su ${fmt(g.kcal)}">
     <svg viewBox="0 0 128 128"><circle cx="64" cy="64" r="54" fill="none" stroke="var(--sunk)" stroke-width="12"/>
     <circle cx="64" cy="64" r="54" fill="none" stroke="${left<0?'var(--warn)':'var(--accent)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-pct)}"/></svg>
     <div class="in"><div class="big num">${fmt(Math.abs(left))}</div><div class="small muted">${left>=0?'kcal rimaste':'kcal in più'}</div><div class="small muted num">${fmt(t.kcal)} / ${fmt(g.kcal)}</div></div></div>
    <div class="bars">${MAC.map(m=>bar(m.l,t[m.k],g[m.k],m.c,m.u)).join('')}${bar('Fibre',t.fib,g.fib,'var(--accent)','g')}</div></div></section>`}

function renderMealChips(){const cur=S.meal||autoMeal();
  $('mealChips').innerHTML=MEALS.map(m=>`<button class="chip ${m===cur?'on':''}" data-meal="${m}">${m}</button>`).join('')}

function renderPreview(){const text=$('q').value.trim();const el=$('preview');
  if(!text){el.innerHTML=`<div class="hint">Scrivi quantità e alimento, separati da virgole. Unità: g, ml, kg, oppure pezzi (1 vasetto, 2 uova, 1 misurino). Invio o ✓ per registrare.</div>`;return}
  const {items}=parseText(text);if(!items.length){el.innerHTML='';return}
  let tk=0;const rows=items.map(it=>{
    if(!it.food){return `<div class="it bad"><div class="nm">“${esc(it.p.q||it.p.raw)}” non è in archivio</div>
      <div class="row">${it.isEan?`<button data-act="eanLookup" data-ean="${it.ean}">Cerca EAN</button>`:''}<button data-act="createFrom" data-name="${esc(it.p.q)}">Crea</button></div></div>`}
    const n=nut(it.food.per100,it.food.micro,it.grams);tk+=n.kcal;
    const others=it.cands.filter(c=>c.f.id!==it.food.id);
    return `<div class="it"><div class="nm">${others.length?`<select class="sel" data-act="pick" data-key="${esc(it.key)}">
        <option value="${it.food.id}">${esc(it.food.name)}</option>${others.map(c=>`<option value="${c.f.id}">${esc(c.f.name)}</option>`).join('')}</select>`:esc(it.food.name)}
      ${it.flag?`<span class="pill est">controlla g</span>`:''}</div>
      <div class="row" style="gap:4px"><input class="gin" inputmode="decimal" data-act="pg" data-key="${esc(it.key)}" value="${it.grams}"><span class="small muted">g</span></div>
      <div class="mac num">${fmt(n.kcal)} kcal · P ${fmt(n.prot,1)} · C ${fmt(n.carb,1)} · G ${fmt(n.fat,1)}</div></div>`}).join('');
  el.innerHTML=`<div class="items">${rows}</div><div class="row between small"><span class="muted">Totale anteprima</span><b class="num">${fmt(tk)} kcal</b></div>`}

function recentFoods(n){const seen=new Set(),out=[];const days=Object.keys(D.days).sort().reverse().slice(0,14);
  for(const ds of days)for(const e of [...D.days[ds]].reverse()){if(seen.has(e.foodId)||!D.foods[e.foodId])continue;seen.add(e.foodId);out.push(e);if(out.length>=n)return out}
  if(out.length<n)foods().sort((a,b)=>(b.uses||0)-(a.uses||0)).forEach(f=>{if(out.length<n&&!seen.has(f.id)&&f.unit){seen.add(f.id);out.push({foodId:f.id,name:f.name,grams:f.unit.grams})}});
  return out}
function renderRecent(){const r=recentFoods(8);$('recent').innerHTML=r.length&&!$('q').value.trim()?`<div class="label" style="margin-bottom:6px">Un tocco per aggiungere</div><div class="chips">${r.map(e=>`<button class="chip" data-act="again" data-food="${esc(e.foodId)}" data-g="${e.grams}">${esc(e.name)} · ${fmt(e.grams)} g</button>`).join('')}</div>`:''}

function renderMeals(){const es=entries();
  if(!es.length){$('meals').innerHTML=`<section class="card"><h2>Pasti</h2><div class="empty">Niente registrato per ${dateLabel(S.date).toLowerCase()}.</div></section>`;return}
  $('meals').innerHTML=`<section class="card"><h2>Pasti</h2>${MEALS.map(m=>{const list=es.filter(e=>e.meal===m);if(!list.length)return '';const t=totals(list);
   return `<div class="meal"><h3><span>${m}</span><span class="num small muted">${fmt(t.kcal)} kcal · P ${fmt(t.prot)}</span></h3><div class="items">${list.map(e=>{const n=nut(e.per100,e.micro,e.grams);const open=S.openEntry===e.id;
     return `<div class="it click" data-act="openE" data-id="${e.id}"><div class="nm">${esc(e.name)} <span class="muted small num">${fmt(e.grams)} g</span>${e.est?` <span class="pill est">stima</span>`:''}</div>
      <div class="k">${fmt(n.kcal)}</div><div class="mac num">P ${fmt(n.prot,1)} · C ${fmt(n.carb,1)} · G ${fmt(n.fat,1)}</div>
      ${open?`<div class="edit" data-stop="1"><input class="gin" id="eg" inputmode="decimal" value="${e.grams}"> g
       <select id="em" class="sel">${MEALS.map(x=>`<option ${x===e.meal?'selected':''}>${x}</option>`).join('')}</select>
       <button class="primary" data-act="saveE" data-id="${e.id}">Salva</button><button class="danger" data-act="delE" data-id="${e.id}">Elimina</button></div>`:''}</div>`}).join('')}</div></div>`}).join('')}</section>`}

function renderMicro(){const es=entries();if(!es.length){$('micro').innerHTML='';return}const t=totals(es),g=T();
  $('micro').innerHTML=`<section class="card"><h2>Micronutrienti</h2><div class="micro">
   ${bar('Zuccheri',t.sug,g.sug,'var(--c)','g',true)}${bar('Saturi',t.sat,Math.round(g.kcal*0.1/9),'var(--f)','g',true)}${bar('Sale',t.salt,g.salt,'var(--warn)','g',true)}
   ${MIC.map(m=>bar(m.l,t[m.k],m.ref,'var(--accent)',m.u)).join('')}</div>
   <p class="small muted">Vitamine e minerali ci sono solo per gli alimenti che li hanno in scheda (stime o dati Open Food Facts), confrontati con i riferimenti LARN per un uomo adulto.${t._micro<es.length?` ${es.length-t._micro} alimenti di oggi senza dati micro.`:''}</p></section>`}

// ================= combinazioni (calcolo locale) =================
const PRIO={'bilanciato':{K:3,P:1.5,C:1,F:1,s:.02},'proteine prima':{K:3,P:4,C:.6,F:.8,s:.02},'pochi grassi':{K:3,P:1.5,C:1,F:3,s:.02},
  'pochi carboidrati':{K:3,P:1.5,C:3,F:1,s:.02},'il più semplice':{K:3,P:1.2,C:.8,F:.8,s:.18}};
function comboSearch(rem,pool,prio){const W=PRIO[prio]||PRIO.bilanciato;
  const tK=Math.max(0,rem.kcal),tP=Math.max(0,rem.prot),tC=Math.max(0,rem.carb),tF=Math.max(0,rem.fat);
  const F=pool.map(f=>{const p=f.per100||{};const fatty=num(p.fat)>50;const step=f.unit&&f.unit.grams>=20?f.unit.grams:5;
    const max=f.unit&&f.unit.grams>=20?f.unit.grams*3:fatty?30:(num(p.kcal)>300?150:350);
    return {f,k:num(p.kcal)/100,p:num(p.prot)/100,c:num(p.carb)/100,fa:num(p.fat)/100,step,max,min:step}}).filter(x=>x.k>0);
  function score(ix,g){let K=0,P=0,C=0,Fa=0;ix.forEach((i,j)=>{const x=F[i];K+=x.k*g[j];P+=x.p*g[j];C+=x.c*g[j];Fa+=x.fa*g[j]});
    const dk=(K-tK)/Math.max(tK,150);return W.K*dk*dk*(K>tK*1.05?4:1)+W.P*((P-tP)/Math.max(tP,15))**2+W.C*((C-tC)/Math.max(tC,20))**2+W.F*((Fa-tF)/Math.max(tF,8))**2+W.s*ix.length}
  function solve(ix){const g=ix.map(i=>{const x=F[i];let v=(tK/ix.length)/x.k;v=Math.round(v/x.step)*x.step;return Math.min(x.max,Math.max(x.min,v))});
    let best=score(ix,g);for(let r=0;r<40;r++){let imp=false;
      for(let j=0;j<ix.length;j++){const x=F[ix[j]];for(const d of [x.step,-x.step,x.step*4,-x.step*4]){const v=g[j]+d;if(v<x.min||v>x.max)continue;g[j]=v;const s=score(ix,g);if(s<best-1e-9){best=s;imp=true}else g[j]-=d}}
      if(!imp)break}return {g,s:best}}
  const res=[],n=F.length;
  for(let a=0;a<n;a++){res.push({ix:[a],...solve([a])});for(let b=a+1;b<n;b++){res.push({ix:[a,b],...solve([a,b])});
    if(n<=30)for(let c=b+1;c<n;c++)res.push({ix:[a,b,c],...solve([a,b,c])})}}
  res.sort((x,y)=>x.s-y.s);const out=[],used={};
  for(const r of res){const key=r.ix.join('-');if(out.some(o=>o.key===key))continue;
    const reuse=r.ix.reduce((s,i)=>s+(used[i]||0),0);if(r.ix.some(i=>(used[i]||0)>=2))continue;
    out.push({key,items:r.ix.map((i,j)=>({food:F[i].f,grams:r.g[j]})),s:r.s});r.ix.forEach(i=>used[i]=(used[i]||0)+1);if(out.length>=5)break}
  return out}
function renderCombo(){const t=totals(entries()),g=T();const rem={kcal:g.kcal-t.kcal,prot:g.prot-t.prot,carb:g.carb-t.carb,fat:g.fat-t.fat};const C=S.combo;
  const list=foods().sort((a,b)=>(b.uses||0)-(a.uses||0)||a.name.localeCompare(b.name));
  $('combo').innerHTML=`<section class="card"><div class="row between"><h2>Completa la giornata</h2><span class="num small muted">mancano ${fmt(Math.max(0,rem.kcal))} kcal</span></div>
   <div class="small num muted">P ${fmt(Math.max(0,rem.prot))} g · C ${fmt(Math.max(0,rem.carb))} g · G ${fmt(Math.max(0,rem.fat))} g</div>
   <div class="label">Con cosa (nessuna scelta = i 25 più usati)</div>
   <div class="chips">${list.map(f=>`<button class="chip ${C.sel.has(f.id)?'on':''}" data-act="csel" data-id="${f.id}">${esc(f.name)}</button>`).join('')}</div>
   <div class="row"><select id="prio" class="sel">${Object.keys(PRIO).map(p=>`<option ${p===C.prio?'selected':''}>${p}</option>`).join('')}</select>
   <button class="primary" data-act="combo" ${rem.kcal<=30?'disabled':''}>Calcola combinazioni</button></div>
   ${rem.kcal<=30?`<div class="small muted">Obiettivo calorico già raggiunto.</div>`:''}
   ${C.opts?(C.opts.length?C.opts.map((o,i)=>{const tt=totals(o.items.map(x=>({per100:x.food.per100,grams:x.grams})));const d=(a,b)=>`${a-b>=0?'+':''}${fmt(a-b)}`;
     return `<div class="opt"><div class="row between"><b>${o.items.map(x=>esc(x.food.name)).join(' + ')}</b><span class="num small">${fmt(tt.kcal)} kcal</span></div>
      <div class="small num">${o.items.map(x=>`${fmt(x.grams)} g ${esc(x.food.name.toLowerCase())}${x.food.unit&&x.grams%x.food.unit.grams===0?` (${x.grams/x.food.unit.grams} ${esc(x.food.unit.name)})`:''}`).join(' · ')}</div>
      <div class="delta muted">P ${fmt(tt.prot)} (${d(tt.prot,rem.prot)}) · C ${fmt(tt.carb)} (${d(tt.carb,rem.carb)}) · G ${fmt(tt.fat)} (${d(tt.fat,rem.fat)}) · kcal ${d(tt.kcal,rem.kcal)}</div>
      <div><button data-act="useOpt" data-i="${i}">Registra questa</button></div></div>`}).join(''):`<div class="empty">Nessuna combinazione utile con questi alimenti.</div>`):''}
  </section>`}

// ================= archivio =================
function renderArchive(){const q=norm(S.fq);let list=foods();
  if(q)list=list.map(f=>({f,s:scoreFood(f,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.f);
  else list.sort((a,b)=>(b.uses||0)-(a.uses||0)||a.name.localeCompare(b.name));
  $('fcount').textContent=`${Object.keys(D.foods).length} alimenti · valori per 100 g`;
  $('flist').innerHTML=list.length?list.map(f=>`<div class="food" data-act="openF" data-id="${f.id}"><div><b>${esc(f.name)}</b>${f.brand?` <span class="muted small">${esc(f.brand)}</span>`:''}${f.source==='stima'?` <span class="pill est">stima</span>`:''}</div>
    <div class="num small">${fmt(f.per100?.kcal)} kcal</div><div class="sub num">P ${fmt(f.per100?.prot,1)} · C ${fmt(f.per100?.carb,1)} · G ${fmt(f.per100?.fat,1)}${f.unit?` · 1 ${esc(f.unit.name)} = ${fmt(f.unit.grams)} g`:''}${f.ean?` · ${esc(f.ean)}`:''}</div></div>`).join('')
    :`<div class="empty">${q?'Nessun alimento trovato.':'Archivio vuoto.'}</div>`}

function openFoodSheet(f,opts={}){const isNew=!f||!f.id;f=f||{};const veil=document.createElement('div');veil.className='veil';
  veil.innerHTML=`<div class="sheet" role="dialog" aria-label="Alimento">
   <div class="row between"><h2>${isNew?'Nuovo alimento':esc(f.name)}</h2><button class="ghost" data-x="close">Chiudi</button></div>
   ${opts.note?`<div class="${opts.noteOk?'card':'banner'} small">${opts.note}</div>`:''}
   ${!isNew?`<div class="card"><span class="label">Aggiungi a ${dateLabel(S.date).toLowerCase()}</span><div class="row">
     <input id="f_g" class="gin" inputmode="decimal" value="${f.lastGrams||f.unit?.grams||100}"> g
     ${f.unit?`<button data-x="unit">1 ${esc(f.unit.name)}</button>`:''}
     <select id="f_m" class="sel">${MEALS.map(m=>`<option ${m===(S.meal||autoMeal())?'selected':''}>${m}</option>`).join('')}</select>
     <button class="primary" data-x="log">Aggiungi</button></div></div>`:''}
   <div class="grid2">
    <label>Nome<input id="f_name" value="${esc(f.name||'')}"></label><label>Marca<input id="f_brand" value="${esc(f.brand||'')}"></label>
    <label>EAN<input id="f_ean" inputmode="numeric" value="${esc(f.ean||'')}"></label><label>Soprannomi (virgola)<input id="f_al" value="${esc((f.aliases||[]).join(', '))}"></label>
    <label>Unità (es. vasetto)<input id="f_un" value="${esc(f.unit?.name||'')}"></label><label>Grammi per unità<input id="f_ug" inputmode="decimal" value="${esc(f.unit?.grams||'')}"></label>
   </div>
   <span class="label">Valori per 100 g (etichetta)</span>
   <div class="grid2">${LBL.map(x=>`<label>${x.l} (${x.u})<input id="f_${x.k}" inputmode="decimal" value="${f.per100?.[x.k]??''}"></label>`).join('')}</div>
   <details><summary class="small">Micronutrienti per 100 g (facoltativi)</summary>
   <div class="grid2" style="margin-top:8px">${MIC.map(x=>`<label>${x.l} (${x.u})<input id="f_m_${x.k}" inputmode="decimal" value="${f.micro?.[x.k]??''}"></label>`).join('')}</div></details>
   <div class="row"><button class="primary" data-x="save">${isNew?'Salva in archivio':'Salva modifiche'}</button>${!isNew?`<button class="danger" data-x="del">Elimina</button>`:''}</div>
   <div id="delc" class="row" hidden><span class="small">Eliminare dall’archivio? I pasti già registrati restano.</span><button class="danger" data-x="del2">Sì, elimina</button></div>
  </div>`;
  document.body.append(veil);const v=id=>veil.querySelector('#'+id)?.value??'';
  if(isNew&&!f.name)setTimeout(()=>veil.querySelector('#f_name')?.focus(),50);
  veil.addEventListener('click',ev=>{if(ev.target===veil){veil.remove();return}const x=ev.target.closest('[data-x]')?.dataset.x;if(!x)return;
    if(x==='close')veil.remove();
    if(x==='unit')veil.querySelector('#f_g').value=f.unit.grams;
    if(x==='log'){const g=num(v('f_g'));if(g<=0){toast('Inserisci i grammi');return}addEntries([{food:food(f.id),grams:g,meal:v('f_m')}]);veil.remove();toast('Aggiunto: '+f.name);if(S.tab!=='oggi'){S.tab='oggi';renderAll()}}
    if(x==='del')veil.querySelector('#delc').hidden=false;
    if(x==='del2'){delete D.foods[f.id];save();veil.remove();toast('Eliminato');renderAll()}
    if(x==='save'){const name=v('f_name').trim();if(!name){toast('Serve un nome');return}
      const per100={};LBL.forEach(l=>per100[l.k]=num(v('f_'+l.k)));if(!per100.kcal&&(per100.prot||per100.carb||per100.fat))per100.kcal=Math.round(per100.prot*4+per100.carb*4+per100.fat*9);
      const micro={};MIC.forEach(m=>{const s=v('f_m_'+m.k);if(s!=='')micro[m.k]=num(s)});
      const ug=num(v('f_ug')),un=v('f_un').trim();const id=f.id||uid();
      const changed=JSON.stringify(per100)!==JSON.stringify(f.per100||{});
      D.foods[id]={...(D.foods[id]||{}),name,brand:v('f_brand').trim()||null,ean:v('f_ean').replace(/\D/g,'')||null,
        aliases:v('f_al').split(',').map(s=>s.trim()).filter(Boolean),unit:un&&ug?{name:un,grams:ug}:null,per100,micro,
        source:isNew?(f.source||'etichetta'):(changed&&f.source==='stima'?'etichetta':f.source||'etichetta'),created:f.created||Date.now(),uses:f.uses||0};
      save();veil.remove();toast('Salvato: '+name);
      if(opts.after)opts.after(id);renderAll()}
  })}

// ================= EAN: scanner + Open Food Facts =================
async function offLookup(ean){const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,product_name_it,product_name_de,product_name_fr,product_name_en,brands,serving_quantity,nutriments`,{cache:'no-store'});
  if(!r.ok)throw new Error('http');const j=await r.json();if(j.status!==1||!j.product)return null;const p=j.product,n=p.nutriments||{};
  const g=k=>n[k+'_100g']!=null?Number(n[k+'_100g']):null;
  let kcal=g('energy-kcal');if(kcal==null&&g('energy')!=null)kcal=g('energy')/4.184;
  const per100={kcal:Math.round(kcal||0),prot:g('proteins')??0,carb:g('carbohydrates')??0,sug:g('sugars')??0,fat:g('fat')??0,sat:g('saturated-fat')??0,fib:g('fiber')??0,salt:g('salt')??0};
  const micro={};const mm=(k,key,f)=>{const v=g(key);if(v!=null)micro[k]=+(v*f).toFixed(3)};
  mm('k','potassium',1000);mm('ca','calcium',1000);mm('mg','magnesium',1000);mm('fe','iron',1000);mm('zn','zinc',1000);mm('vita','vitamin-a',1e6);
  mm('vitc','vitamin-c',1000);mm('vitd','vitamin-d',1e6);mm('vite','vitamin-e',1000);mm('b12','vitamin-b12',1e6);mm('fol','vitamin-b9',1e6);
  const name=p.product_name_it||p.product_name||p.product_name_en||p.product_name_de||p.product_name_fr||'';
  const sq=Number(p.serving_quantity)||0;
  return {name,brand:(p.brands||'').split(',')[0].trim()||null,ean,aliases:[],unit:sq>0?{name:'porzione',grams:sq}:null,per100,micro,source:'off'}}

async function handleEan(ean){ean=String(ean).replace(/\D/g,'');const local=foods().find(f=>f.ean===ean);
  if(local){openFoodSheet(local,{note:'Già in archivio.',noteOk:true});return}
  if(!navigator.onLine){openFoodSheet({ean},{note:'Sei offline: inserisci i valori dall’etichetta. Quando torni online puoi anche riscansionare.'});return}
  toast('Cerco '+ean+'…');
  try{const f=await offLookup(ean);
    if(!f){openFoodSheet({ean},{note:'Prodotto non trovato su Open Food Facts: inserisci i valori dall’etichetta.'});return}
    openFoodSheet(f,{note:'Valori da Open Food Facts (database compilato dagli utenti): confrontali con l’etichetta, poi salva.',noteOk:true})}
  catch(e){openFoodSheet({ean},{note:'Ricerca non riuscita: inserisci i valori dall’etichetta.'})}}

function loadScript(src){return new Promise((res,rej)=>{if(window.Html5Qrcode)return res();const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.append(s)})}
async function openScanner(){const veil=document.createElement('div');veil.className='veil';
  veil.innerHTML=`<div class="sheet"><div class="row between"><h2>Scansiona codice a barre</h2><button class="ghost" data-x="close">Chiudi</button></div>
   <div id="reader"></div><div class="hint" id="scanMsg">Inquadra il codice EAN da 10–15 cm.</div>
   <div class="row"><input id="manEan" inputmode="numeric" placeholder="oppure digita l’EAN" class="grow"><button data-x="man">Cerca</button></div></div>`;
  document.body.append(veil);let sc=null;
  const close=async()=>{try{if(sc&&sc.isScanning)await sc.stop()}catch(e){}veil.remove()};
  veil.addEventListener('click',async ev=>{if(ev.target===veil)return close();const x=ev.target.closest('[data-x]')?.dataset.x;
    if(x==='close')close();if(x==='man'){const e=veil.querySelector('#manEan').value.replace(/\D/g,'');if(e.length>=8){await close();handleEan(e)}else toast('EAN non valido')}});
  try{await loadScript('vendor/html5-qrcode.min.js');
    const F=window.Html5QrcodeSupportedFormats;
    sc=new Html5Qrcode('reader',{formatsToSupport:[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E],verbose:false});
    await sc.start({facingMode:'environment'},{fps:12,qrbox:(w,h)=>({width:Math.min(300,w*0.85),height:Math.min(140,h*0.5)})},
      async code=>{if(navigator.vibrate)navigator.vibrate(40);await close();handleEan(code)},()=>{});
  }catch(e){const m=veil.querySelector('#scanMsg');if(m)m.textContent='Fotocamera non disponibile: consenti l’accesso nelle impostazioni o digita l’EAN qui sotto.'}}

// ================= settimana =================
function renderWeek(){const g=T();const days=[];for(let i=6;i>=0;i--){const ds=shift(todayStr(),-i);const es=D.days[ds]||[];days.push({ds,t:totals(es),n:es.length})}
  const logged=days.filter(d=>d.n);const max=Math.max(g.kcal*1.25,...days.map(d=>d.t.kcal));const avg=k=>logged.length?logged.reduce((s,d)=>s+d.t[k],0)/logged.length:0;
  $('weekv').innerHTML=`<section class="card"><h2>Ultimi 7 giorni</h2>
   <div class="week"><div class="tline" style="bottom:${(g.kcal/max)*140+30}px"></div>
   ${days.map(d=>`<div class="wk"><div class="v">${d.n?fmt(d.t.kcal):''}</div><div class="b ${d.t.kcal>g.kcal*1.08?'o':''}" style="height:${(d.t.kcal/max)*140}px"></div><div class="l">${new Date(d.ds+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short'})}</div></div>`).join('')}</div>
   <p class="small muted">Tratteggio: obiettivo ${fmt(g.kcal)} kcal. Medie sui ${logged.length} giorni registrati.</p>
   <div style="overflow-x:auto"><table><thead><tr><th></th><th>Media</th><th>Obiettivo</th><th>%</th></tr></thead><tbody>
   ${[['kcal','Energia','kcal'],['prot','Proteine','g'],['carb','Carboidrati','g'],['fat','Grassi','g'],['fib','Fibre','g'],['salt','Sale','g']].map(([k,l,u])=>`<tr><td>${l}</td><td class="num">${fmtAuto(avg(k))} ${u}</td><td class="num">${fmtAuto(g[k])} ${u}</td><td class="num">${g[k]?fmt(avg(k)/g[k]*100):'–'}%</td></tr>`).join('')}
   </tbody></table></div></section>`}

// ================= obiettivi + backup =================
function renderGoals(){const t=T(),c=D.settings?.calc||{peso:'',altezza:'',eta:23,sesso:'M',att:'1.55',obj:'mantenimento'};
  $('goalsv').innerHTML=`<section class="card"><h2>Obiettivi giornalieri</h2>
   <div class="grid2">${[['kcal','Calorie','kcal'],['prot','Proteine','g'],['carb','Carboidrati','g'],['fat','Grassi','g'],['fib','Fibre','g'],['sug','Zuccheri max','g'],['salt','Sale max','g']].map(([k,l,u])=>`<label>${l} (${u})<input id="t_${k}" inputmode="decimal" value="${t[k]}"></label>`).join('')}</div>
   <div class="small muted num">Dai macro: ${fmt(num(t.prot)*4+num(t.carb)*4+num(t.fat)*9)} kcal</div>
   <div><button class="primary" data-act="saveT">Salva obiettivi</button></div></section>
   <section class="card"><h2>Calcolo rapido</h2><p class="small muted">Mifflin-St Jeor × attività. Proteine 2 g/kg in definizione, 1,8 g/kg altrimenti; grassi 0,9 g/kg; il resto carboidrati.</p>
   <div class="grid2"><label>Peso (kg)<input id="c_peso" inputmode="decimal" value="${esc(c.peso)}"></label><label>Altezza (cm)<input id="c_altezza" inputmode="decimal" value="${esc(c.altezza)}"></label>
    <label>Età<input id="c_eta" inputmode="numeric" value="${esc(c.eta)}"></label>
    <label>Sesso<select id="c_sesso"><option value="M" ${c.sesso==='M'?'selected':''}>Uomo</option><option value="F" ${c.sesso==='F'?'selected':''}>Donna</option></select></label>
    <label>Attività<select id="c_att">${[['1.2','Sedentario'],['1.375','Leggera (1-3)'],['1.55','Moderata (3-5)'],['1.725','Alta (6-7)'],['1.9','Molto alta']].map(([v,l])=>`<option value="${v}" ${String(c.att)===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Obiettivo<select id="c_obj">${['definizione','mantenimento','massa'].map(o=>`<option ${o===c.obj?'selected':''}>${o}</option>`).join('')}</select></label></div>
   <div><button data-act="calc">Calcola e applica</button></div></section>
   <section class="card"><h2>Backup</h2><p class="small muted">I dati stanno solo su questo telefono. Esporta un backup ogni tanto (va in File o dove preferisci) e reimportalo se cambi dispositivo.</p>
   <div class="row"><button data-act="export">Esporta backup</button><label class="chip" style="cursor:pointer;padding:.5rem .8rem">Importa backup<input type="file" id="imp" accept="application/json,.json" hidden></label></div>
   <div class="hint">${Object.keys(D.foods).length} alimenti · ${Object.keys(D.days).length} giorni registrati</div></section>`}

async function exportBackup(){const blob=new Blob([JSON.stringify({app:'diario-macro',v:1,exported:new Date().toISOString(),...D})],{type:'application/json'});
  const name=`diario-macro-${todayStr()}.json`;const file=new File([blob],name,{type:'application/json'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});return}}catch(e){if(e.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function importBackup(file){const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);if(!j.foods||!j.days)throw 0;
    const veil=document.createElement('div');veil.className='veil';
    veil.innerHTML=`<div class="sheet"><h2>Importa backup</h2><p class="small">${Object.keys(j.foods).length} alimenti e ${Object.keys(j.days).length} giorni. Come vuoi importarli?</p>
     <div class="row"><button class="primary" data-x="merge">Unisci ai dati attuali</button><button class="danger" data-x="replace">Sostituisci tutto</button><button class="ghost" data-x="close">Annulla</button></div></div>`;
    document.body.append(veil);veil.addEventListener('click',ev=>{const x=ev.target.closest('[data-x]')?.dataset.x;if(!x&&ev.target!==veil)return;
      if(x==='merge'){Object.assign(D.foods,j.foods);for(const ds in j.days){const ids=new Set((D.days[ds]||[]).map(e=>e.id));D.days[ds]=[...(D.days[ds]||[]),...j.days[ds].filter(e=>!ids.has(e.id))]}if(j.settings&&!D.settings)D.settings=j.settings;toast('Backup unito')}
      if(x==='replace'){D={foods:j.foods,days:j.days,settings:j.settings||null,created:j.created||Date.now()};toast('Backup ripristinato')}
      saveNow();veil.remove();renderAll()})}catch(e){toast('File non valido')}};r.readAsText(file)}

// ================= eventi =================
function autosize(){const q=$('q');q.style.height='auto';q.style.height=Math.min(140,q.scrollHeight)+'px'}
$('q').addEventListener('input',()=>{S.over={};autosize();renderPreview();renderRecent()});
$('q').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();logFromInput()}});
$('logBtn').onclick=logFromInput;$('scanBtn').onclick=openScanner;$('scanBtn2').onclick=openScanner;
$('newFood').onclick=()=>openFoodSheet(null);
$('fq').addEventListener('input',e=>{S.fq=e.target.value;renderArchive()});
document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;S.tab=b.dataset.tab;renderAll();window.scrollTo(0,0)});
$('prevDay').onclick=()=>{S.date=shift(S.date,-1);S.openEntry=null;S.combo.opts=null;renderAll()};
$('nextDay').onclick=()=>{if(S.date<todayStr()){S.date=shift(S.date,1);S.openEntry=null;S.combo.opts=null;renderAll()}};
window.addEventListener('online',renderHeader);window.addEventListener('offline',renderHeader);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(S.date!==todayStr()&&S._lastToday&&S.date===S._lastToday)S.date=todayStr();S._lastToday=todayStr();renderAll()}});
S._lastToday=todayStr();

document.body.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.act==='pick'){S.over[t.dataset.key]={...(S.over[t.dataset.key]||{}),foodId:t.value,grams:undefined};delete S.over[t.dataset.key].grams;renderPreview()}
  if(t.dataset.act==='pg'){S.over[t.dataset.key]={...(S.over[t.dataset.key]||{}),grams:Math.round(num(t.value))};const f=parseText($('q').value).items.find(i=>i.key===t.dataset.key);if(f&&f.food&&!S.over[t.dataset.key].foodId)S.over[t.dataset.key].foodId=f.food.id;renderPreview()}
  if(t.id==='prio')S.combo.prio=t.value;
  if(t.id==='imp'&&t.files?.[0]){importBackup(t.files[0]);t.value=''}});
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-act],[data-meal]');if(!b||b.tagName==='SELECT'||(b.tagName==='INPUT'))return;
  const st=e.target.closest('[data-stop]');if(st&&!st.contains(b))return;
  if(b.dataset.meal){S.meal=b.dataset.meal;renderMealChips();return}
  const a=b.dataset.act;
  if(a==='again'){const f=food(b.dataset.food);if(f){addEntries([{food:f,grams:num(b.dataset.g),meal:S.meal||autoMeal()}]);toast('Aggiunto: '+f.name)}}
  if(a==='createFrom'){const name=b.dataset.name||'';openFoodSheet({name:name.charAt(0).toUpperCase()+name.slice(1),aliases:name?[name]:[]},{after:()=>{S.over={};renderPreview()}})}
  if(a==='eanLookup')handleEan(b.dataset.ean);
  if(a==='openE'){S.openEntry=S.openEntry===b.dataset.id?null:b.dataset.id;renderMeals()}
  if(a==='saveE'){const en=entries().find(x=>x.id===b.dataset.id);const g=num($('eg').value);if(en&&g>0){en.grams=Math.round(g);en.meal=$('em').value;S.openEntry=null;save();renderAll()}}
  if(a==='delE'){D.days[S.date]=entries().filter(x=>x.id!==b.dataset.id);S.openEntry=null;save();renderAll();toast('Eliminato')}
  if(a==='csel'){const id=b.dataset.id;S.combo.sel.has(id)?S.combo.sel.delete(id):S.combo.sel.add(id);b.classList.toggle('on')}
  if(a==='combo'){const t=totals(entries()),g=T();const rem={kcal:g.kcal-t.kcal,prot:g.prot-t.prot,carb:g.carb-t.carb,fat:g.fat-t.fat};
    let pool=foods();pool=S.combo.sel.size?pool.filter(f=>S.combo.sel.has(f.id)):pool.sort((a,b)=>(b.uses||0)-(a.uses||0)).slice(0,25);
    S.combo.opts=comboSearch(rem,pool,S.combo.prio);renderCombo()}
  if(a==='useOpt'){const o=S.combo.opts[+b.dataset.i];addEntries(o.items.map(x=>({food:x.food,grams:x.grams,meal:S.meal||autoMeal()})));S.combo.opts=null;renderCombo();toast('Combinazione registrata')}
  if(a==='openF')openFoodSheet(food(b.dataset.id));
  if(a==='saveT'){const targets={};Object.keys(DEF_T).forEach(k=>targets[k]=num($('t_'+k).value));D.settings={...(D.settings||{}),targets};save();toast('Obiettivi salvati');renderGoals()}
  if(a==='calc'){const v=id=>$(id).value;const peso=num(v('c_peso')),alt=num(v('c_altezza')),eta=num(v('c_eta')),sesso=v('c_sesso'),att=num(v('c_att')),obj=v('c_obj');
    if(!peso||!alt||!eta){toast('Inserisci peso, altezza ed età');return}
    const bmr=10*peso+6.25*alt-5*eta+(sesso==='M'?5:-161);let kcal=Math.round(bmr*att*(obj==='definizione'?.85:obj==='massa'?1.1:1)/10)*10;
    const prot=Math.round(peso*(obj==='definizione'?2:1.8)),fat=Math.round(peso*.9),carb=Math.max(0,Math.round((kcal-prot*4-fat*9)/4));
    D.settings={...(D.settings||{}),targets:{...T(),kcal,prot,carb,fat},calc:{peso,altezza:alt,eta,sesso,att:String(att),obj}};save();toast(`Applicato: ${fmt(kcal)} kcal`);renderGoals()}
  if(a==='export')exportBackup();
});

// ================= avvio =================
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
save();renderAll();
window.DM={parseText,comboSearch,D,S};
})();
