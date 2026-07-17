import { X } from 'lucide-react';
import { matchSummary } from '../lib/multisport';
import type { Competition, Match } from '../types';

export function EntryCard({ competition, entryId, name, label, onClose, avatar }: {
  competition: Competition; entryId: string; name: string; label: (id: string | null) => string; onClose: () => void; avatar?: string;
}) {
  const rows: { phase: string; m: Match }[] = [];
  competition.groups.forEach(g => g.matches.forEach(m => { if (m.playerAId === entryId || m.playerBId === entryId) rows.push({ phase: g.name, m }); }));
  competition.ko.main.forEach(r => r.matches.forEach(m => { if (m.playerAId === entryId || m.playerBId === entryId) rows.push({ phase: r.name, m }); }));
  competition.ko.consolation.forEach(r => r.matches.forEach(m => { if (m.playerAId === entryId || m.playerBId === entryId) rows.push({ phase: 'Útecha · ' + r.name, m }); }));

  const persp = (m: Match) => {
    const isA = m.playerAId === entryId;
    const s = matchSummary(m);
    const opponent = isA ? m.playerBId : m.playerAId;
    const setsP = m.result ? '' : m.sets.filter(x => x.a !== null && x.b !== null).map(x => (isA ? `${x.a}:${x.b}` : `${x.b}:${x.a}`)).join(', ');
    return { my: isA ? s.sa : s.sb, op: isA ? s.sb : s.sa, myp: isA ? s.pa : s.pb, opp: isA ? s.pb : s.pa, opponent, setsP, won: m.winnerId === entryId, played: !!m.winnerId, special: m.specialResult };
  };

  let w = 0, l = 0, sf = 0, sa = 0, pf = 0, pa = 0;
  rows.forEach(({ m }) => { if (!m.winnerId) return; const p = persp(m); if (p.won) w++; else l++; sf += p.my; sa += p.op; pf += p.myp; pa += p.opp; });

  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div className="card-head-id">{avatar && <img className="avatar card-avatar" src={avatar} alt={name} />}<div><span className="kicker">{competition.name}</span><h2>{name}</h2></div></div><button className="icon-button" onClick={onClose}><X /></button></div>
    <div className="modal-body">
      <div className="card-stats"><div><strong>{w}</strong><span>výhry</span></div><div><strong>{l}</strong><span>prehry</span></div><div><strong>{sf}:{sa}</strong><span>sety</span></div><div><strong>{pf}:{pa}</strong><span>loptičky</span></div></div>
      <div className="entry-matches">{rows.length === 0 ? <p className="muted">Zatiaľ žiadne zápasy.</p> : rows.map(({ phase, m }, i) => { const p = persp(m); return <div key={i} className="entry-match">
        <div className="em-top"><span className="em-phase">{phase}</span>{p.played && <span className={p.won ? 'em-res win' : 'em-res loss'}>{p.won ? 'Výhra' : 'Prehra'}</span>}</div>
        <div className="em-main"><span>{label(p.opponent)}</span><b>{p.played ? (p.special ? p.special.replace('_', ' ') : `${p.my}:${p.op}`) : 'nehrané'}</b></div>
        {p.setsP && <div className="em-sets">{p.setsP}</div>}
      </div>; })}</div>
    </div>
  </div></div>;
}
