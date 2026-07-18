import { X } from 'lucide-react';
import type { Match } from '../types';

export type Side = { name: string; club: string; photo?: string };

const setScore = (m: Match): { a: number; b: number } => {
  if (m.result) return { a: m.result.a, b: m.result.b };
  let a = 0, b = 0;
  m.sets.forEach(s => { if (s.a > s.b) a++; else if (s.b > s.a) b++; });
  return { a, b };
};

function Ava({ photo, name }: { photo?: string; name: string }) {
  const ini = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return photo ? <img className="mo-ava" src={photo} alt={name} /> : <span className="mo-ava mo-ava-ph">{ini || '?'}</span>;
}

/** Prehľad zápasu (len na čítanie) — hlavička s kontextom, skóre a sety po boxoch. */
export function MatchOverview({ tournament, competition, event, groupName, date, table, matchNo, a, b, m, onClose }: {
  tournament: string; competition: string; event: string;
  groupName?: string; date?: string; table?: number | null; matchNo?: string;
  a: Side; b: Side; m: Match; onClose: () => void;
}) {
  const s = setScore(m);
  const sets = m.sets.filter(x => x.a || x.b);
  const aWin = m.winnerId === m.playerAId, bWin = m.winnerId === m.playerBId;
  return <div className="modal-backdrop" onClick={onClose}><div className="modal mo" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><h2>Prehľad zápasu</h2><button className="icon-button" onClick={onClose}><X /></button></div>

    <div className="mo-meta">
      <div><span>Turnaj:</span> {tournament}</div>
      <div><span>Kategória:</span> {competition}</div>
      <div><span>Udalosť:</span> {event}</div>
      {groupName && <div><span>Skupina:</span> {groupName}</div>}
      {date && <div><span>Dátum:</span> {date}{m.scheduledTime ? ` ${m.scheduledTime}` : ''}</div>}
      {matchNo && <div><span>Zápas:</span> {matchNo}</div>}
      {table != null && <div><span>Stôl:</span> {table}</div>}
    </div>

    <div className="mo-players">
      <div className={`mo-side ${aWin ? 'mo-win' : ''}`}><Ava photo={a.photo} name={a.name} /><div><strong>{a.name}</strong><span>{a.club || '—'}</span></div></div>
      <div className={`mo-side mo-right ${bWin ? 'mo-win' : ''}`}><div><strong>{b.name}</strong><span>{b.club || '—'}</span></div><Ava photo={b.photo} name={b.name} /></div>
    </div>

    <div className="mo-score">{m.winnerId ? `${s.a} : ${s.b}` : 'zatiaľ nehrané'}</div>
    {m.specialResult && <div className="mo-special">{m.specialResult}</div>}

    {sets.length > 0 && <div className="mo-sets">
      {sets.map((x, i) => <div className="mo-set" key={i}><span className="mo-set-h">SET {i + 1}</span>
        <div className={x.a > x.b ? 'mo-set-v mo-set-win' : 'mo-set-v'}>{x.a}</div>
        <div className={x.b > x.a ? 'mo-set-v mo-set-win' : 'mo-set-v'}>{x.b}</div>
      </div>)}
    </div>}
  </div></div>;
}
