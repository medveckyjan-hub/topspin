// Spustenie: skopíruj skompilované jadro do multisport.mjs, potom: node src/lib/qualification.test.mjs
import * as M from './multisport.mjs';
let ok=0,fail=0;
const t=(n,c)=>{try{c()?ok++:(fail++,console.error("ZLYHALO:",n))}catch(e){fail++;console.error("VÝNIMKA:",n,e.message)}};
const mk=n=>{const ids=Array.from({length:n},(_,i)=>"p"+(i+1));
  return [ids,new Map(ids.map((id,i)=>[id,{id,name:"H"+(i+1),club:"K",rating:200-i,memberIds:[id]}]))];};
const play=q=>{q.brackets.forEach(b=>b.rounds.forEach(r=>r.matches.forEach(m=>{
  if(m.playerAId&&m.playerBId&&!m.winnerId)Object.assign(m,M.normalizeMatch({...m,sets:[{a:11,b:1},{a:11,b:1},{a:11,b:1}]},5));})));
  return M.advanceQualification(q);};
const finish=q=>{for(let i=0;i<6;i++)q=play(q);return q;};

const [i20,m20]=mk(20);
let q=M.createQualification(i20,m20,8,4,5);
t("8 priamo + 4 vetvy",()=>q.directIds.length===8&&q.brackets.length===4);
t("nikto nepostupuje pred odohraním",()=>M.qualificationWinners(q).every(w=>w===null));
t("nedohratá kvalifikácia nie je hotová",()=>!M.qualificationDone(q));
q=finish(q);
t("po dohratí sú všetci víťazi",()=>M.qualificationDone(q)&&M.qualificationWinners(q).every(Boolean));
t("do skupín ide 8+4",()=>M.qualifiedForGroups(q).length===12);
t("žiadny duplikát",()=>new Set(M.qualifiedForGroups(q)).size===12);

const [i7,m7]=mk(7);
let q2=M.createQualification(i7,m7,3,2,3);
t("nepárny počet: 3 priamo, 2 vetvy",()=>q2.directIds.length===3&&q2.brackets.length===2);
q2=finish(q2);
t("nepárny počet dohratý",()=>M.qualificationDone(q2)&&M.qualifiedForGroups(q2).length===5);

const [i5,m5]=mk(5);
const q3=M.createQualification(i5,m5,4,3,5);
t("viac miest než hráčov sa oreže",()=>q3.brackets.length===1);
const q4=M.createQualification(i5,m5,99,2,5);
t("priamo viac než prihlásených sa oreže",()=>q4.directIds.length===5&&q4.brackets.length===1);

const [i9,m9]=mk(9);
let q5=M.createQualification(i9,m9,1,2,5);
const b=q5.brackets[0];
t("vetva s voľným žrebom sa nedohrá sama",()=>{
  const r0=b.rounds[0];
  const bye=r0.matches.find(x=>(x.playerAId&&!x.playerBId)||(x.playerBId&&!x.playerAId));
  return bye?M.qualificationWinners(q5)[0]===null:true;});
q5=finish(q5);
t("aj s voľným žrebom nakoniec postúpi jeden",()=>M.qualificationWinners(q5).filter(Boolean).length===2);

console.log(`KVALIFIKÁCIA: ${ok} prešlo, ${fail} zlyhalo`);
