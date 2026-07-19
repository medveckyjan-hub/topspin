// Reťaz fáz: kvalifikácia → skupiny → druhé skupiny → pavúk + útechy.
// Spustenie: skompilované jadro ulož ako ./multisport.mjs a ./stages.mjs, potom node src/lib/stages.test.mjs
import * as M from './multisport.mjs';
import * as S from './stages.mjs';
let ok=0,fail=0;
const t=(n,c)=>{try{c()?ok++:(fail++,console.error("ZLYHALO:",n))}catch(e){fail++;console.error("VÝNIMKA:",n,e.message)}};

const mkEntries=(n,clubFn=(i)=>"K"+(i%9))=>{
  const es=Array.from({length:n},(_,i)=>({id:"p"+i,name:"Hráč "+i,club:clubFn(i),rating:1000-i*3,memberIds:["p"+i]}));
  return [es,new Map(es.map(e=>[e.id,e]))];
};
const winSets=(bestOf)=>{const need=bestOf===7?4:bestOf===5?3:2;
  return Array.from({length:need},()=>({a:11,b:5}));};
const playAll=(stage)=>{
  if(stage.kind==="groups"){(stage.groups||[]).forEach(g=>g.matches=g.matches.map(m=>
    m.playerAId&&m.playerBId?M.normalizeMatch({...m,sets:winSets(stage.bestOf)},stage.bestOf):m));return stage;}
  let s={...stage};
  for(let i=0;i<10;i++){
    s={...s,rounds:(s.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>
      m.playerAId&&m.playerBId&&!m.winnerId?M.normalizeMatch({...m,sets:winSets(s.bestOf)},s.bestOf):m)}))};
    s=S.advanceStage(s);
    if(S.stageDone(s)){
      // dohraj ešte zápas o 3. miesto, ktorý vznikne až po semifinále
      s={...s,rounds:(s.rounds||[]).map(r=>({...r,matches:r.matches.map(m=>
        m.playerAId&&m.playerBId&&!m.winnerId?M.normalizeMatch({...m,sets:winSets(s.bestOf)},s.bestOf):m)}))};
      break;
    }
  }
  return s;
};

// ===== Reťaz: kvalifikačný pavúk → skupiny → druhé skupiny → finálový pavúk =====
const [es,map]=mkEntries(32);
const ids=es.map(e=>e.id);

let qual=S.newStage({name:"Kvalifikácia",kind:"knockout",source:{from:"entries"},bestOf:3,seeding:"rating",thirdPlace:false});
let plan={stages:[qual]};
qual=S.buildStage(plan,qual,ids,map); plan={stages:[qual]};
t("kvalifikácia sa naplnila všetkými prihlásenými",()=>qual.rounds.filter(r=>r.kind!=="third")[0].matches.length===16);
qual=playAll(qual); plan={stages:[qual]};
t("kvalifikácia je dohratá",()=>S.stageDone(qual));

// skupiny z vypadnutých+víťaza? Reálne: do skupín ide 16 najlepších = víťazi 1. kola.
// Modelujeme: skupiny berú postupujúcich z kvalifikácie (víťaz pavúka = 1),
// preto pre skutočný scenár použijeme skupinovú fázu zo VŠETKÝCH prihlásených.
let g1=S.newStage({name:"1. kolo skupín",kind:"groups",source:{from:"entries"},preferredSize:4,qualifiersPerGroup:2,bestOf:5});
plan={stages:[g1]}; g1=S.buildStage(plan,g1,ids,map); plan={stages:[g1]};
t("1. kolo: 8 skupín po 4",()=>g1.groups.length===8&&g1.groups.every(g=>g.entryIds.length===4));
g1=playAll(g1); plan={stages:[g1]};
t("1. kolo dohraté",()=>S.stageDone(g1));
t("postupuje 16",()=>S.stageQualified(g1,map).length===16);
t("vypadáva 16",()=>S.stageEliminated(g1,map).length===16);

// 2. kolo skupín z postupujúcich
let g2=S.newStage({name:"2. kolo skupín",kind:"groups",source:{from:"stage",stageId:g1.id,take:"qualified"},preferredSize:4,qualifiersPerGroup:2,bestOf:5});
plan={stages:[g1,g2]}; g2=S.buildStage(plan,g2,ids,map); plan={stages:[g1,g2]};
t("2. kolo: 4 skupiny zo 16 postupujúcich",()=>g2.groups.length===4&&g2.groups.flatMap(g=>g.entryIds).length===16);
g2=playAll(g2); plan={stages:[g1,g2]};
t("2. kolo dohraté a postupuje 8",()=>S.stageDone(g2)&&S.stageQualified(g2,map).length===8);

// útecha 1. kola (z vypadnutých) — pavúk
let u1=S.newStage({name:"Útecha 1. kola",kind:"knockout",source:{from:"stage",stageId:g1.id,take:"eliminated"},consolation:true,bestOf:5,thirdPlace:true});
plan={stages:[g1,g2,u1]}; u1=S.buildStage(plan,u1,ids,map);
t("útecha 1. kola má 16 miest",()=>u1.rounds.filter(r=>r.kind!=="third")[0].matches.length===8);
u1=playAll(u1); plan={stages:[g1,g2,u1]};
t("útecha 1. kola dohratá",()=>S.stageDone(u1));

// finálový pavúk z postupujúcich 2. kola
let ko=S.newStage({name:"Finálový pavúk",kind:"knockout",source:{from:"stage",stageId:g2.id,take:"qualified"},bestOf:7,thirdPlace:true,seeding:"groups"});
plan={stages:[g1,g2,u1,ko]}; ko=S.buildStage(plan,ko,ids,map);
t("finálový pavúk má 8 miest",()=>ko.rounds.filter(r=>r.kind!=="third")[0].matches.length===4);
ko=playAll(ko); plan={stages:[g1,g2,u1,ko]};
t("finálový pavúk dohratý",()=>S.stageDone(ko));

// útecha 2. kola
let u2=S.newStage({name:"Útecha 2. kola",kind:"knockout",source:{from:"stage",stageId:g2.id,take:"eliminated"},consolation:true,bestOf:5,thirdPlace:true});
plan={stages:[g1,g2,u1,ko,u2]}; u2=S.buildStage(plan,u2,ids,map); u2=playAll(u2);
plan={stages:[g1,g2,u1,ko,u2]};
t("útecha 2. kola dohratá (8 vypadnutých)",()=>S.stageDone(u2));

// ===== Konečné poradie =====
const order=S.finalPlacement(plan,ids,map);
t("konečné poradie obsahuje všetkých 32",()=>order.length===32&&new Set(order).size===32);
t("víťaz finálového pavúka je prvý",()=>order[0]===S.stageRanking(ko,map)[0]);
const koRank=S.stageRanking(ko,map);
t("prvá osmička = účastníci finálového pavúka",()=>order.slice(0,8).every(id=>koRank.includes(id)));
const u2Set=new Set(S.stageRanking(u2,map));
t("útecha 2. kola nasleduje za hlavnou vetvou",()=>order.slice(8,16).every(id=>u2Set.has(id)));
const u1Set=new Set(S.stageRanking(u1,map));
t("útecha 1. kola je posledná",()=>order.slice(16).every(id=>u1Set.has(id)));
t("nikto nie je na dvoch miestach",()=>order.length===new Set(order).size);

console.log(`REŤAZ FÁZ: ${ok} prešlo, ${fail} zlyhalo`);
