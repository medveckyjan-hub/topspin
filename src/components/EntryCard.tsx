import { X } from 'lucide-react';
import { matchSummary } from '../lib/multisport';
import { playerMatches, playerTotals } from '../lib/playercard';
import type { Match, TournamentState } from '../types';

/**
 * Karta hráča — VŠETKY jeho zápasy naprieč všetkými súťažami a stupňami.
 *
 * Predtým čítala len základné skupiny a pavúk, takže play-off skupiny,
 * finálová skupina, kvalifikácia, reťaz fáz a družstvá v nej chýbali.
 */
export function EntryCard({ state, playerId, name, label, onClose, avatar }: {
  state: TournamentState;
  playerId: string;
  name: string;
  label: (id: string | null) => string;
  onClose: () => void;
  avatar?: string;
}) {
  const rows = playerMatches(state, playerId);
  const t = playerTotals(rows);

  const persp = (m: Match, entryId: string) => {
    const isA = m.playerAId === entryId;
    const s = matchSummary(m);
    const opponent = isA ? m.playerBId : m.playerAId;
    const sets = m.sets
      .filter(x => x.a !== null && x.b !== null)
      .map(x => (isA ? `${x.a}:${x.b}` : `${x.b}:${x.a}`))
      .join(', ');
    return {
      my: isA ? s.sa : s.sb, op: isA ? s.sb : s.sa,
      opponent, sets, won: m.winnerId === entryId, played: !!m.winnerId,
      special: m.specialResult,
    };
  };

  // zoskupenie po súťažiach, aby bolo vidno, v čom všetkom hráč štartoval
  const bySutaz: { name: string; rows: typeof rows }[] = [];
  rows.forEach(r => {
    const last = bySutaz[bySutaz.length - 1];
    if (last && last.name === r.competition) last.rows.push(r);
    else bySutaz.push({ name: r.competition, rows: [r] });
  });

  const pocet = (n: number) => (n === 1 ? 'zápas' : n < 5 ? 'zápasy' : 'zápasov');

  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head">
        <div className="card-head-id">
          {avatar && <img className="avatar card-avatar" src={avatar} alt={name} />}
          <div>
            <span className="kicker">
              {bySutaz.length === 0 ? 'Bez zápasov'
                : bySutaz.length === 1 ? bySutaz[0].name
                : bySutaz.map(s => s.name).join(' · ')}
            </span>
            <h2>{name}</h2>
          </div>
        </div>
        <button className="icon-button" onClick={onClose}><X /></button>
      </div>

      <div className="modal-body">
        <div className="card-stats">
          <div><strong>{t.wins}</strong><span>výhry</span></div>
          <div><strong>{t.losses}</strong><span>prehry</span></div>
          <div><strong>{t.setsFor}:{t.setsAgainst}</strong><span>sety</span></div>
          <div><strong>{t.ptsFor}:{t.ptsAgainst}</strong><span>loptičky</span></div>
        </div>

        {rows.length === 0
          ? <p className="muted">Zatiaľ žiadne zápasy.</p>
          : bySutaz.map((sut, si) => <div className="card-comp" key={si}>
            <h3 className="card-comp-h">{sut.name} <span className="muted">· {sut.rows.length} {pocet(sut.rows.length)}</span></h3>
            <div className="entry-matches">{sut.rows.map((r, i) => {
              const p = persp(r.m, r.entryId);
              return <div key={i} className="entry-match">
                <div className="em-top">
                  <span className="em-phase">{r.phase}</span>
                  {p.played && <span className={p.won ? 'em-res win' : 'em-res loss'}>{p.won ? 'Výhra' : 'Prehra'}</span>}
                </div>
                <div className="em-main">
                  <span>{label(p.opponent)}</span>
                  <b>{p.played ? (p.special ? p.special.replace('_', ' ') : `${p.my}:${p.op}`) : 'nehrané'}</b>
                </div>
                {p.sets && <div className="em-sets">{p.sets}</div>}
                {(r.m.scheduledTime || r.m.table) && <div className="em-when">
                  {r.m.scheduledTime && <span>{r.m.scheduledTime}</span>}
                  {r.m.table && <span>stôl {r.m.table}</span>}
                </div>}
              </div>;
            })}</div>
          </div>)}
      </div>
    </div>
  </div>;
}
