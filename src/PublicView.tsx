import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Trophy, Settings, Link as LinkIcon } from 'lucide-react';
import { EntryCard } from './components/EntryCard';
import { getTournament } from './lib/supabase';
import { TEAM_SYSTEMS, entryMap, groupRounds, scoreText, setsText, standings } from './lib/multisport';
import type { Competition, KnockoutRound, Match, TournamentState } from './types';
import './styles.css';

export function PublicView() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<TournamentState | null>(null);
  const [name, setName] = useState('');
  const [state, setState] = useState<'load' | 'ok' | 'missing'>('load');
  const [card, setCard] = useState<{ comp: Competition; entryId: string; name: string } | null>(null);

  useEffect(() => { (async () => { try { const t = await getTournament(slug); if (t) { setData(t.data); setName(t.name); setState('ok'); } else setState('missing'); } catch { setState('missing'); } })(); }, [slug]);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/t/${slug}` : '';

  const label = useMemo(() => {
    if (!data) return (_: string | null) => '—';
    const pm = new Map(data.players.map(p => [p.id, p]));
    return (id: string | null): string => {
      if (!id) return '—';
      if (id.includes('+')) return id.split('+').map(x => pm.get(x)?.name || '?').join(' / ');
      return pm.get(id)?.name || data.pairs.find(x => x.id === id)?.name || data.teams.find(x => x.id === id)?.name || '—';
    };
  }, [data]);

  if (state === 'load') return <Shell><p className="muted">Načítavam…</p></Shell>;
  if (state === 'missing' || !data) return <Shell><h2>Turnaj sa nenašiel</h2><Link className="button" to="/">Domov</Link></Shell>;

  const bracketRounds = (rounds: KnockoutRound[]) => <div className="pub-bracket">{rounds.map(r => <div className="pub-round" key={r.id}>
    <h4>{r.name}</h4>{r.matches.map(m => <PubMatch key={m.id} m={m} label={label} />)}</div>)}</div>;

  return <Shell>
    <div className="pub-head">
      <div><span className="kicker">Výsledky turnaja</span><h1>{name}</h1><p>{data.settings.date}{data.settings.venue ? ` · ${data.settings.venue}` : ''}</p></div>
      <div className="pub-qr"><QRCodeSVG value={url} size={104} /><button className="link-btn" onClick={() => navigator.clipboard?.writeText(url)}><LinkIcon size={13} />Kopírovať odkaz</button></div>
    </div>

    {data.competitions.length === 0 && <p className="muted">Turnaj sa pripravuje.</p>}

    {data.competitions.map(c => {
      const em = entryMap(c, data.players, data.pairs, data.teams);
      if (c.type === 'teams') return <section className="card pub-card" key={c.id}>
        <h2>{c.name} · {TEAM_SYSTEMS[c.teamSystemId || 'CORBILLON'].name}</h2>
        {c.teamTies.map(t => { const home = data.teams.find(x => x.id === t.homeTeamId), away = data.teams.find(x => x.id === t.awayTeamId); return <div className="pub-tie" key={t.id}>
          <div className="pub-tie-head"><strong>{home?.name}</strong><b>{t.homeScore} : {t.awayScore}</b><strong>{away?.name}</strong></div>
          {t.rubbers.map(r => <div className="pub-rubber" key={r.id}><span>{r.order}. {label(r.match.playerAId)} – {label(r.match.playerBId)}</span><span>{r.match.winnerId ? scoreText(r.match) : '—'}</span></div>)}
        </div>; })}
      </section>;

      return <section className="card pub-card" key={c.id}>
        <h2>{c.name}</h2>
        {c.groups.map(g => <div className="pub-group" key={g.id}>
          <h3>{g.name}</h3>
          <div className="table-scroll"><table><thead><tr><th>#</th><th>Účastník</th><th>V</th><th>P</th><th>B</th><th>Sety</th><th>Lopt.</th></tr></thead><tbody>
            {standings(g, em).map(r => <tr key={r.entry.id} className={r.qualified ? 'qualified-row' : ''}><td>{r.position}</td><td><strong className="clickable-name" onClick={() => setCard({ comp: c, entryId: r.entry.id, name: r.entry.name })}>{r.entry.name}</strong></td><td>{r.wins}</td><td>{r.losses}</td><td><b>{r.matchPoints}</b></td><td>{r.setsFor}:{r.setsAgainst}</td><td>{r.pointsFor}:{r.pointsAgainst}</td></tr>)}
          </tbody></table></div>
          <div className="pub-matches">{g.matches.filter(m => m.winnerId).map(m => <PubMatch key={m.id} m={m} label={label} />)}</div>
          {g.playoff && <div className="pub-playoff"><h4>Play-off skupiny</h4>
            <div className="pub-matches"><div className="pub-po-row"><span className="pb-label">O 1. miesto</span><PubMatch m={g.playoff.final} label={label} /></div>
            {g.playoff.third && <div className="pub-po-row"><span className="pb-label">O 3. miesto</span><PubMatch m={g.playoff.third} label={label} /></div>}</div>
          </div>}
        </div>)}
        {c.groups.length > 0 && <details className="pub-rounds"><summary>Rozpis po kolách</summary>
          {groupRounds(c).map(r => <div className="round-block" key={r.round}><h4>{r.round}. kolo</h4>
            {r.items.map(({ groupName, m }) => <div className="round-match" key={m.id}><span className="rm-group">{groupName}</span><span className="rm-players">{label(m.playerAId)} <i>–</i> {label(m.playerBId)}</span><span className="rm-meta">{m.table ? `stôl ${m.table}` : ''}{m.scheduledTime ? ` · ${m.scheduledTime}` : ''}{m.winnerId ? ` · ${scoreText(m)}` : ''}</span></div>)}
          </div>)}
        </details>}
        {c.ko.main.length > 0 && <><h3 className="bracket-title">Hlavný pavúk</h3>{bracketRounds(c.ko.main)}</>}
        {c.ko.consolation.length > 0 && <><h3 className="bracket-title">Útecha</h3>{bracketRounds(c.ko.consolation)}</>}
      </section>;
    })}

    {hasSchedule(data.competitions) && <section className="card pub-card"><h2>Harmonogram</h2>
      <div className="table-scroll"><table><thead><tr><th>Čas</th><th>Stôl</th><th>Súťaž</th><th>Zápas</th></tr></thead><tbody>
        {data.competitions.flatMap(c => c.groups.flatMap(g => g.matches.filter(m => m.scheduledTime).map(m => ({ c, m }))))
          .sort((a, b) => (a.m.scheduledTime || '').localeCompare(b.m.scheduledTime || ''))
          .map(({ c, m }) => <tr key={m.id}><td>{m.scheduledTime}</td><td>{m.table ?? '—'}</td><td>{c.name}</td><td>{label(m.playerAId)} – {label(m.playerBId)}</td></tr>)}
      </tbody></table></div></section>}

    <div className="pub-foot"><Link className="button" to={`/t/${slug}/admin`}><Settings size={16} />Spravovať (PIN)</Link></div>
    {card && <EntryCard competition={card.comp} entryId={card.entryId} name={card.name} label={label} avatar={data.players.find(p => p.id === card.entryId)?.photo} onClose={() => setCard(null)} />}
  </Shell>;
}

function PubMatch({ m, label }: { m: Match; label: (id: string | null) => string }) {
  const detail = m.winnerId ? setsText(m) : '';
  return <div className="pub-match">
    <div className="pm-row"><span className={m.winnerId === m.playerAId ? 'win' : ''}>{label(m.playerAId)}</span><b>{m.winnerId ? scoreText(m) : 'vs'}</b><span className={m.winnerId === m.playerBId ? 'win' : ''}>{label(m.playerBId)}</span></div>
    {detail && <div className="pm-sets">{detail}</div>}
  </div>;
}
const hasSchedule = (cs: Competition[]) => cs.some(c => c.groups.some(g => g.matches.some(m => m.scheduledTime)));

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="public-shell"><header className="public-top"><Link className="brand-line" to="/"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></Link></header><main className="public-main">{children}</main></div>;
}
