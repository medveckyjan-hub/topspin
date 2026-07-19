import { describe, expect, it } from 'vitest';
import * as M from './multisport';
import * as S from './stages';

describe('reťaz fáz', () => {
// Reťaz fáz: kvalifikácia → skupiny → druhé skupiny → pavúk + útechy.

const mkEntries: any = (n,clubFn=(i)=>"K"+(i%9))=>{
  const es=Array.from({length:n},(_,i)=>({id:"p"+i,name:"Hráč "+i,club:clubFn(i),rating:1000-i*3,memberIds:["p"+i]}));
  return [es,new Map(es.map(e=>[e.id,e]))];
};
const winSets: any = (bestOf)=>{const need=bestOf===7?4:bestOf===5?3:2;
  return Array.from({length:need},()=>({a:11,b:5}));};
const playAll: any = (stage)=>{
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
let plan: any= {stages:[qual]};
qual=S.buildStage(plan,qual,ids,map); plan={stages:[qual]};
const __chk1 = (() => { try { return !!(qual.rounds.filter(r=>r.kind!=="third")[0].matches.length===16); } catch (e) { return e; } })();
it("kvalifikácia sa naplnila všetkými prihlásenými", () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });
qual=playAll(qual); plan={stages:[qual]};
const __chk2 = (() => { try { return !!(S.stageDone(qual)); } catch (e) { return e; } })();
it("kvalifikácia je dohratá", () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });

// skupiny z vypadnutých+víťaza? Reálne: do skupín ide 16 najlepších = víťazi 1. kola.
// Modelujeme: skupiny berú postupujúcich z kvalifikácie (víťaz pavúka = 1),
// preto pre skutočný scenár použijeme skupinovú fázu zo VŠETKÝCH prihlásených.
let g1=S.newStage({name:"1. kolo skupín",kind:"groups",source:{from:"entries"},preferredSize:4,qualifiersPerGroup:2,bestOf:5});
plan={stages:[g1]}; g1=S.buildStage(plan,g1,ids,map); plan={stages:[g1]};
const __chk3 = (() => { try { return !!(g1.groups.length===8&&g1.groups.every(g=>g.entryIds.length===4)); } catch (e) { return e; } })();
it("1. kolo: 8 skupín po 4", () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });
g1=playAll(g1); plan={stages:[g1]};
const __chk4 = (() => { try { return !!(S.stageDone(g1)); } catch (e) { return e; } })();
it("1. kolo dohraté", () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });
const __chk5 = (() => { try { return !!(S.stageQualified(g1,map).length===16); } catch (e) { return e; } })();
it("postupuje 16", () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });
const __chk6 = (() => { try { return !!(S.stageEliminated(g1,map).length===16); } catch (e) { return e; } })();
it("vypadáva 16", () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });

// 2. kolo skupín z postupujúcich
let g2=S.newStage({name:"2. kolo skupín",kind:"groups",source:{from:"stage",stageId:g1.id,take:"qualified"},preferredSize:4,qualifiersPerGroup:2,bestOf:5});
plan={stages:[g1,g2]}; g2=S.buildStage(plan,g2,ids,map); plan={stages:[g1,g2]};
const __chk7 = (() => { try { return !!(g2.groups.length===4&&g2.groups.flatMap(g=>g.entryIds).length===16); } catch (e) { return e; } })();
it("2. kolo: 4 skupiny zo 16 postupujúcich", () => { if (__chk7 instanceof Error) throw __chk7; expect(__chk7).toBe(true); });
g2=playAll(g2); plan={stages:[g1,g2]};
const __chk8 = (() => { try { return !!(S.stageDone(g2)&&S.stageQualified(g2,map).length===8); } catch (e) { return e; } })();
it("2. kolo dohraté a postupuje 8", () => { if (__chk8 instanceof Error) throw __chk8; expect(__chk8).toBe(true); });

// útecha 1. kola (z vypadnutých) — pavúk
let u1=S.newStage({name:"Útecha 1. kola",kind:"knockout",source:{from:"stage",stageId:g1.id,take:"eliminated"},consolation:true,bestOf:5,thirdPlace:true});
plan={stages:[g1,g2,u1]}; u1=S.buildStage(plan,u1,ids,map);
const __chk9 = (() => { try { return !!(u1.rounds.filter(r=>r.kind!=="third")[0].matches.length===8); } catch (e) { return e; } })();
it("útecha 1. kola má 16 miest", () => { if (__chk9 instanceof Error) throw __chk9; expect(__chk9).toBe(true); });
u1=playAll(u1); plan={stages:[g1,g2,u1]};
const __chk10 = (() => { try { return !!(S.stageDone(u1)); } catch (e) { return e; } })();
it("útecha 1. kola dohratá", () => { if (__chk10 instanceof Error) throw __chk10; expect(__chk10).toBe(true); });

// finálový pavúk z postupujúcich 2. kola
let ko=S.newStage({name:"Finálový pavúk",kind:"knockout",source:{from:"stage",stageId:g2.id,take:"qualified"},bestOf:7,thirdPlace:true,seeding:"groups"});
plan={stages:[g1,g2,u1,ko]}; ko=S.buildStage(plan,ko,ids,map);
const __chk11 = (() => { try { return !!(ko.rounds.filter(r=>r.kind!=="third")[0].matches.length===4); } catch (e) { return e; } })();
it("finálový pavúk má 8 miest", () => { if (__chk11 instanceof Error) throw __chk11; expect(__chk11).toBe(true); });
ko=playAll(ko); plan={stages:[g1,g2,u1,ko]};
const __chk12 = (() => { try { return !!(S.stageDone(ko)); } catch (e) { return e; } })();
it("finálový pavúk dohratý", () => { if (__chk12 instanceof Error) throw __chk12; expect(__chk12).toBe(true); });

// útecha 2. kola
let u2=S.newStage({name:"Útecha 2. kola",kind:"knockout",source:{from:"stage",stageId:g2.id,take:"eliminated"},consolation:true,bestOf:5,thirdPlace:true});
plan={stages:[g1,g2,u1,ko,u2]}; u2=S.buildStage(plan,u2,ids,map); u2=playAll(u2);
plan={stages:[g1,g2,u1,ko,u2]};
const __chk13 = (() => { try { return !!(S.stageDone(u2)); } catch (e) { return e; } })();
it("útecha 2. kola dohratá (8 vypadnutých)", () => { if (__chk13 instanceof Error) throw __chk13; expect(__chk13).toBe(true); });

// ===== Konečné poradie =====
const order=S.finalPlacement(plan,ids,map);
const __chk14 = (() => { try { return !!(order.length===32&&new Set(order).size===32); } catch (e) { return e; } })();
it("konečné poradie obsahuje všetkých 32", () => { if (__chk14 instanceof Error) throw __chk14; expect(__chk14).toBe(true); });
const __chk15 = (() => { try { return !!(order[0]===S.stageRanking(ko,map)[0]); } catch (e) { return e; } })();
it("víťaz finálového pavúka je prvý", () => { if (__chk15 instanceof Error) throw __chk15; expect(__chk15).toBe(true); });
const koRank=S.stageRanking(ko,map);
const __chk16 = (() => { try { return !!(order.slice(0,8).every(id=>koRank.includes(id))); } catch (e) { return e; } })();
it("prvá osmička = účastníci finálového pavúka", () => { if (__chk16 instanceof Error) throw __chk16; expect(__chk16).toBe(true); });
const u2Set=new Set(S.stageRanking(u2,map));
const __chk17 = (() => { try { return !!(order.slice(8,16).every(id=>u2Set.has(id))); } catch (e) { return e; } })();
it("útecha 2. kola nasleduje za hlavnou vetvou", () => { if (__chk17 instanceof Error) throw __chk17; expect(__chk17).toBe(true); });
const u1Set=new Set(S.stageRanking(u1,map));
const __chk18 = (() => { try { return !!(order.slice(16).every(id=>u1Set.has(id))); } catch (e) { return e; } })();
it("útecha 1. kola je posledná", () => { if (__chk18 instanceof Error) throw __chk18; expect(__chk18).toBe(true); });
const __chk19 = (() => { try { return !!(order.length===new Set(order).size); } catch (e) { return e; } })();
it("nikto nie je na dvoch miestach", () => { if (__chk19 instanceof Error) throw __chk19; expect(__chk19).toBe(true); });


});
