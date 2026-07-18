import { standings } from '../lib/multisport';
import type { GenericEntry, Match, Player, TournamentGroup } from '../types';

const setScore = (m: Match): { a: number; b: number } => {
  if (m.result) return { a: m.result.a, b: m.result.b };
  let a = 0, b = 0;
  m.sets.forEach(s => { const x = s.a ?? 0, y = s.b ?? 0; if (x > y) a++; else if (y > x) b++; });
  return { a, b };
};

function Ava({ photo, name }: { photo?: string; name: string }) {
  const ini = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return photo ? <img className="gt-ava" src={photo} alt={name} /> : <span className="gt-ava gt-ava-ph">{ini || '?'}</span>;
}

/** Krížová tabuľka skupiny (formát SSTZ): riadky v poradí nasadenia, stĺpce 1..n,
 *  S = sety, V/P = výhry/prehry, B = body, P = konečné umiestnenie v skupine. */
export function GroupTable({ group, map, players, onMatch, onName }: {
  group: TournamentGroup;
  map: Map<string, GenericEntry>;
  players: Player[];
  onMatch?: (m: Match, slotA: number, slotB: number) => void;
  onName?: (e: GenericEntry) => void;
}) {
  const slots = group.entryIds.map(id => map.get(id)).filter((e): e is GenericEntry => !!e);
  const st = standings(group, map);
  const posOf = new Map(st.map(r => [r.entry.id, r.position]));
  const rowOf = new Map(st.map(r => [r.entry.id, r]));
  const photoOf = (id: string) => players.find(p => p.id === id)?.photo;
  const between = (x: string, y: string) => group.matches.find(m =>
    (m.playerAId === x && m.playerBId === y) || (m.playerAId === y && m.playerBId === x));

  const order = group.matches.slice().sort((a, b) => a.round - b.round).map(m => {
    const i = group.entryIds.indexOf(m.playerAId || ''), j = group.entryIds.indexOf(m.playerBId || '');
    return i >= 0 && j >= 0 ? `${i + 1}-${j + 1}` : null;
  }).filter(Boolean) as string[];

  return <div className="gt-wrap">
    <div className="table-scroll"><table className="gt">
      <thead><tr>
        <th className="gt-num">#</th><th className="gt-player">Hráč</th>
        {slots.map((_, i) => <th key={i} className="gt-cell">{i + 1}</th>)}
        <th className="gt-cell">S</th><th className="gt-cell">V/P</th><th className="gt-cell">B</th><th className="gt-cell gt-place">P</th>
      </tr></thead>
      <tbody>
        {slots.map((e, i) => {
          const r = rowOf.get(e.id);
          const place = posOf.get(e.id) ?? i + 1;
          return <tr key={e.id} className={place === 1 ? 'gt-first' : place === 2 ? 'gt-second' : ''}>
            <td className="gt-num">{i + 1}</td>
            <td className="gt-player">
              <div className="gt-id">
                <Ava photo={photoOf(e.id)} name={e.name} />
                <div><strong className={onName ? 'clickable-name' : ''} onClick={() => onName?.(e)}>{e.name}</strong><span className="gt-club">{e.club || '—'}</span></div>
              </div>
            </td>
            {slots.map((o, j) => {
              if (i === j) return <td key={j} className="gt-cell gt-diag">•••</td>;
              const m = between(e.id, o.id);
              if (!m || !m.winnerId) return <td key={j} className="gt-cell gt-empty">—</td>;
              const s = setScore(m);
              const mine = m.playerAId === e.id ? s.a : s.b;
              const his = m.playerAId === e.id ? s.b : s.a;
              const won = m.winnerId === e.id;
              return <td key={j} className={`gt-cell gt-res ${won ? 'gt-win' : 'gt-loss'}${onMatch ? ' gt-click' : ''}`}
                onClick={() => onMatch?.(m, i + 1, j + 1)}>{mine}:{his}</td>;
            })}
            <td className="gt-cell">{r ? `${r.setsFor}:${r.setsAgainst}` : '—'}</td>
            <td className="gt-cell">{r ? `${r.wins}/${r.losses}` : '—'}</td>
            <td className="gt-cell"><b>{r?.matchPoints ?? 0}</b></td>
            <td className={`gt-cell gt-place ${place === 1 ? 'p1' : place === 2 ? 'p2' : ''}`}><b>{place}</b></td>
          </tr>;
        })}
      </tbody>
    </table></div>
    {order.length > 0 && <div className="gt-order"><span>Poradie zápasov:</span>{order.map((o, i) => <em key={i}>{o}</em>)}</div>}
  </div>;
}
