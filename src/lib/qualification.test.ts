import { describe, expect, it } from 'vitest';
import * as M from './multisport';

describe('kvalifikácia', () => {
const mk: any=n=>{const ids=Array.from({length:n},(_,i)=>"p"+(i+1));
  return [ids,new Map(ids.map((id,i)=>[id,{id,name:"H"+(i+1),club:"K",rating:200-i,memberIds:[id]}]))];};
const play=q=>{q.brackets.forEach(b=>b.rounds.forEach(r=>r.matches.forEach(m=>{
  if(m.playerAId&&m.playerBId&&!m.winnerId)Object.assign(m,M.normalizeMatch({...m,sets:[{a:11,b:1},{a:11,b:1},{a:11,b:1}]},5));})));
  return M.advanceQualification(q);};
const finish=q=>{for(let i=0;i<6;i++)q=play(q);return q;};

const [i20, m20]: any =mk(20);
let q=M.createQualification(i20,m20,8,4,5);
const __chk1 = (() => { try { return !!(q.directIds.length===8&&q.brackets.length===4); } catch (e) { return e; } })();
it("8 priamo + 4 vetvy", () => { if (__chk1 instanceof Error) throw __chk1; expect(__chk1).toBe(true); });
const __chk2 = (() => { try { return !!(M.qualificationWinners(q).every(w=>w===null)); } catch (e) { return e; } })();
it("nikto nepostupuje pred odohraním", () => { if (__chk2 instanceof Error) throw __chk2; expect(__chk2).toBe(true); });
const __chk3 = (() => { try { return !!(!M.qualificationDone(q)); } catch (e) { return e; } })();
it("nedohratá kvalifikácia nie je hotová", () => { if (__chk3 instanceof Error) throw __chk3; expect(__chk3).toBe(true); });
q=finish(q);
const __chk4 = (() => { try { return !!(M.qualificationDone(q)&&M.qualificationWinners(q).every(Boolean)); } catch (e) { return e; } })();
it("po dohratí sú všetci víťazi", () => { if (__chk4 instanceof Error) throw __chk4; expect(__chk4).toBe(true); });
const __chk5 = (() => { try { return !!(M.qualifiedForGroups(q).length===12); } catch (e) { return e; } })();
it("do skupín ide 8+4", () => { if (__chk5 instanceof Error) throw __chk5; expect(__chk5).toBe(true); });
const __chk6 = (() => { try { return !!(new Set(M.qualifiedForGroups(q)).size===12); } catch (e) { return e; } })();
it("žiadny duplikát", () => { if (__chk6 instanceof Error) throw __chk6; expect(__chk6).toBe(true); });

const [i7, m7]: any =mk(7);
let q2=M.createQualification(i7,m7,3,2,3);
const __chk7 = (() => { try { return !!(q2.directIds.length===3&&q2.brackets.length===2); } catch (e) { return e; } })();
it("nepárny počet: 3 priamo, 2 vetvy", () => { if (__chk7 instanceof Error) throw __chk7; expect(__chk7).toBe(true); });
q2=finish(q2);
const __chk8 = (() => { try { return !!(M.qualificationDone(q2)&&M.qualifiedForGroups(q2).length===5); } catch (e) { return e; } })();
it("nepárny počet dohratý", () => { if (__chk8 instanceof Error) throw __chk8; expect(__chk8).toBe(true); });

const [i5, m5]: any =mk(5);
const q3=M.createQualification(i5,m5,4,3,5);
const __chk9 = (() => { try { return !!(q3.brackets.length===1); } catch (e) { return e; } })();
it("viac miest než hráčov sa oreže", () => { if (__chk9 instanceof Error) throw __chk9; expect(__chk9).toBe(true); });
const q4=M.createQualification(i5,m5,99,2,5);
// ZMENA SPRÁVANIA (oprava P0-02): keď sa priamo kvalifikujú všetci prihlásení,
// nevzniká už prázdna vetva, ktorá by sa navždy tvárila ako nedohratá.
const __chk10 = (() => { try { return !!(q4.directIds.length===5&&q4.brackets.length===0); } catch (e) { return e; } })();
it("priamo viac než prihlásených sa oreže a nevznikne prázdna vetva", () => { if (__chk10 instanceof Error) throw __chk10; expect(__chk10).toBe(true); });

const [i9, m9]: any =mk(9);
let q5=M.createQualification(i9,m9,1,2,5);
const b=q5.brackets[0];
const __chk11 = (() => { try { return !!(() => {
  const r0=b.rounds[0];
  const bye=r0.matches.find(x=>(x.playerAId&&!x.playerBId)||(x.playerBId&&!x.playerAId));
  return bye?M.qualificationWinners(q5)[0]===null:true;})(); } catch (e) { return e; } })();
it("vetva s voľným žrebom sa nedohrá sama", () => { if (__chk11 instanceof Error) throw __chk11; expect(__chk11).toBe(true); });
q5=finish(q5);
const __chk12 = (() => { try { return !!(M.qualificationWinners(q5).filter(Boolean).length===2); } catch (e) { return e; } })();
it("aj s voľným žrebom nakoniec postúpi jeden", () => { if (__chk12 instanceof Error) throw __chk12; expect(__chk12).toBe(true); });


});
