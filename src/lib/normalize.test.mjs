// kópia normalizeState bez závislosti na Supabase klientovi
function normalizeState(raw, name='Turnaj'){
  const d=(raw&&typeof raw==='object')?raw:{};
  const s=d.settings??{};
  return {version:5,
    settings:{name:s.name||name,date:s.date||new Date().toISOString().slice(0,10),venue:s.venue??'',
      tables:s.tables??8,matchMinutes:s.matchMinutes??20,restMinutes:s.restMinutes??5,startTime:s.startTime??'09:00'},
    players:Array.isArray(d.players)?d.players:[],pairs:Array.isArray(d.pairs)?d.pairs:[],
    teams:Array.isArray(d.teams)?d.teams:[],competitions:Array.isArray(d.competitions)?d.competitions:[]};
}
const cases=[['prázdny objekt (nový turnaj)',{}],['null',null],['bez nastavení',{players:[],competitions:[]}],
 ['bez súťaží',{settings:{name:'X',date:'2026-07-18'}}],['súťaže ako null',{competitions:null,players:null}],
 ['cudzí tvar',{nieco:'ine'}],['reťazec namiesto objektu','nezmysel']];
let ok=0,fail=0;
for(const [label,input] of cases){
  try{const s=normalizeState(input,'Turnaj');
    const good=Array.isArray(s.competitions)&&Array.isArray(s.players)&&Array.isArray(s.pairs)&&Array.isArray(s.teams)
      &&!!s.settings&&typeof s.settings.date==='string'&&s.settings.tables>0;
    good?ok++:(fail++,console.error('ZLYHALO:',label));
  }catch(e){fail++;console.error('VÝNIMKA:',label,e.message);}
}
console.log(`NEÚPLNÉ DÁTA: ${ok} prešlo, ${fail} zlyhalo`);
