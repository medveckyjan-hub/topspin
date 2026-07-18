import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Settings, Link as LinkIcon, UserPlus, FileText, Images, Video, Plus, Trophy, CalendarClock } from 'lucide-react';
import { EntryCard } from './components/EntryCard';
import { GroupTable } from './components/GroupTable';
import { MatchOverview, type Side } from './components/MatchOverview';
import { getTournament, listMedia, listRegistrations, embedUrl, type MediaItem, type Registration } from './lib/supabase';
import { RegistrationForm } from './components/RegistrationForm';
import { AuthBar } from './components/AuthBar';
import { TEAM_SYSTEMS, entryMap, finalOrder, groupRounds, scoreText, setsText, standings, tieTables } from './lib/multisport';
import type { Competition, GenericEntry, KnockoutRound, Match, TournamentState } from './types';
import './styles.css';
import { skDate } from './lib/format';

export function PublicView() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<TournamentState | null>(null);
  const [name, setName] = useState('');
  const [state, setState] = useState<'load' | 'ok' | 'missing'>('load');
  const [card, setCard] = useState<{ comp: Competition; entryId: string; name: string } | null>(null);
  const [mo, setMo] = useState<{ comp: Competition; em: Map<string, GenericEntry>; m: Match; event: string; groupName?: string; matchNo?: string } | null>(null);
  const [tab, setTab] = useState<string>('');   // '' = prvá kategória, inak id súťaže alebo 'harmonogram'/'registracia'/...
  const [sec, setSec] = useState<'zoznam' | 'skupiny' | 'playoff' | 'pavuk' | 'poradie'>('skupiny');
  const [regs, setRegs] = useState<Registration[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [regOpen, setRegOpen] = useState(false);
  const [regDone, setRegDone] = useState(false);
  const loadExtras = async () => {
    try { setRegs(await listRegistrations(slug)); } catch { /* ignore */ }
    try { setMedia(await listMedia(slug)); } catch { /* ignore */ }
  };
  useEffect(() => { loadExtras(); }, [slug]);

  useEffect(() => {
    let alive = true;
    let ticks = 0;
    let lastAction = Date.now();
    const seen = () => { lastAction = Date.now(); };
    const load = async (first: boolean) => {
      try {
        const t = await getTournament(slug);
        if (!alive) return;
        if (t) { setData(t.data); setName(t.name); setState('ok'); }
        else if (first) setState('missing');
      } catch { if (first && alive) setState('missing'); }
    };
    load(true);
    // Neaktivita: skrytá karta sa neobnovuje vôbec, dlho nečinná len zriedka.
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;      // karta v pozadí → nič
      ticks++;
      const idleMin = (Date.now() - lastAction) / 60000;
      if (idleMin > 20 && ticks % 10 !== 0) return;             // po 20 min nečinnosti len raz za 5 min
      load(false);
    }, 30000);
    const onVis = () => { if (document.visibilityState === 'visible') { seen(); load(false); } };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerdown', seen);
    window.addEventListener('keydown', seen);
    window.addEventListener('scroll', seen, { passive: true });
    return () => {
      alive = false; clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', seen);
      window.removeEventListener('keydown', seen);
      window.removeEventListener('scroll', seen);
    };
  }, [slug]);
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

  const defaultSection = (c: Competition): 'zoznam' | 'skupiny' | 'playoff' | 'pavuk' | 'poradie' =>
    (c.groups.length ? 'skupiny' : c.ko.main.length ? 'pavuk' : 'zoznam');

  if (state === 'load') return <Shell><p className="muted">Načítavam…</p></Shell>;
  if (state === 'missing' || !data) return <Shell><h2>Turnaj sa nenašiel</h2><Link className="button" to="/">Domov</Link></Shell>;

  const EXTRA = ['harmonogram', 'registracia', 'propozicie', 'galeria', 'videa'];
  const activeComp: Competition | undefined = EXTRA.includes(tab)
    ? undefined
    : (data.competitions.find(c => c.id === tab) ?? data.competitions[0]);

  const bracketRounds = (rounds: KnockoutRound[], c: Competition, em: Map<string, GenericEntry>) => {
    const main = rounds.filter(r => r.kind !== 'third');
    const third = rounds.find(r => r.kind === 'third');
    const open = (m: Match, ev: string) => setMo({ comp: c, em, m, event: ev });
    return <>
      <div className="kbracket">{main.map((r, ri) => {
        const last = ri === main.length - 1;
        const pairs: Match[][] = [];
        for (let i = 0; i < r.matches.length; i += 2) pairs.push(r.matches.slice(i, i + 2));
        return <div className={`kround${last ? ' kround-last' : ''}`} key={r.id}>
          <h4>{r.name}</h4>
          <div className="kround-body">{pairs.map((pr, pi) => <div className={`kpair${pr.length < 2 || last ? ' kpair-solo' : ''}`} key={pi}>
            {pr.map(m => <KMatch key={m.id} m={m} em={em} onClick={() => open(m, r.name)} />)}
          </div>)}</div>
        </div>;
      })}</div>
      {third && third.matches.length > 0 && <div className="kthird"><h4>O 3. miesto</h4>
        <div className="kround-body"><div className="kpair kpair-solo">{third.matches.map(m => <KMatch key={m.id} m={m} em={em} onClick={() => open(m, 'O 3. miesto')} />)}</div></div>
      </div>}
    </>;
  };

  return <Shell>
    <div className="pub-head">
      <div><span className="kicker">Výsledky turnaja</span><h1>{name}</h1><p>{skDate(data.settings.date)}{data.settings.venue ? ` · ${data.settings.venue}` : ''}</p><span className="auto-refresh">↻ Výsledky sa obnovujú automaticky</span></div>
      <div className="pub-qr"><QRCodeSVG value={url} size={104} /><button className="link-btn" onClick={() => navigator.clipboard?.writeText(url)}><LinkIcon size={13} />Kopírovať odkaz</button></div>
    </div>

    {(() => {
      const props = media.filter(x => x.kind === 'propozicie');
      const photos = media.filter(x => x.kind === 'photo');
      const vids = media.filter(x => x.kind === 'video');
      const extra: [string, string, React.ReactNode, boolean][] = [
        ['harmonogram', 'Harmonogram', <CalendarClock size={15} key="i" />, hasSchedule(data.competitions)],
        ['registracia', 'Registrácia', <UserPlus size={15} key="i" />, true],
        ['propozicie', 'Propozície', <FileText size={15} key="i" />, props.length > 0],
        ['galeria', 'Galéria', <Images size={15} key="i" />, photos.length > 0],
        ['videa', 'Videá', <Video size={15} key="i" />, vids.length > 0],
      ];
      return <nav className="pub-tabs">
        {data.competitions.map(c => <button key={c.id} className={`pub-tab${activeComp?.id === c.id ? ' active' : ''}`}
          onClick={() => { setTab(c.id); setSec(defaultSection(c)); }}><Trophy size={15} />{c.name}</button>)}
        {extra.filter(t => t[3]).map(([k, lbl, ic]) =>
          <button key={k} className={`pub-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{ic}{lbl}</button>)}
      </nav>;
    })()}

    {tab === 'registracia' && <section className="card pub-card">
      <div className="card-header"><h2>Registrácia</h2><button className="button primary" onClick={() => { setRegDone(false); setRegOpen(true); }}><Plus size={16} />Chcem sa registrovať</button></div>
      {regDone && <p className="reg-ok">Prihláška bola odoslaná. Ďakujeme!</p>}
      <h3 className="reg-h">Registrovaní ({regs.length})</h3>
      {regs.length === 0 ? <p className="muted">Zatiaľ nikto nie je prihlásený.</p> :
        <div className="reg-list">{regs.map((r, i) => <div className="reg-row" key={r.id}>
          <span className="reg-n"><em>#</em>{i + 1}</span>
          <div className="reg-who"><strong>{r.first_name} {r.last_name}</strong><span>{r.club || '—'}</span></div>
          <div className="reg-meta"><span className="reg-cap">Krajina</span>{r.country}</div>
          <div className="reg-meta"><span className="reg-cap">Rok nar. / licencia</span>{r.birth_year ?? '—'} / {r.license_until ? skDate(r.license_until) : '-'}</div>
          {r.categories?.length > 0 && <div className="reg-meta reg-cats-view"><span className="reg-cap">Kategórie</span>{r.categories.join(', ')}</div>}
        </div>)}</div>}
    </section>}

    {tab === 'propozicie' && <section className="card pub-card"><h2>Propozície</h2>
      <div className="media-list">{media.filter(x => x.kind === 'propozicie').map(x => <a className="media-doc" key={x.id} href={x.url} target="_blank" rel="noreferrer">
        <FileText size={20} /><div><strong>{x.title || 'Propozície turnaja'}</strong><span>Otvoriť PDF</span></div></a>)}</div>
    </section>}

    {tab === 'galeria' && <section className="card pub-card"><h2>Fotogaléria</h2>
      <div className="gallery">{media.filter(x => x.kind === 'photo').map(x => <a className="gal-item" key={x.id} href={x.url} target="_blank" rel="noreferrer">
        <img src={x.url} alt={x.title || 'Foto'} loading="lazy" /></a>)}</div>
    </section>}

    {tab === 'videa' && <section className="card pub-card"><h2>Videá</h2>
      <div className="videos">{media.filter(x => x.kind === 'video').map(x => <div className="vid" key={x.id}>
        {x.title && <h4>{x.title}</h4>}
        <div className="vid-frame"><iframe src={embedUrl(x.url)} title={x.title || 'Video'} allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" /></div></div>)}</div>
    </section>}

    {activeComp && data.competitions.length === 0 && <p className="muted">Turnaj sa pripravuje.</p>}

    {activeComp && (() => {
      const c = activeComp;
      const em = entryMap(c, data.players, data.pairs, data.teams);
      const hasPo = c.groups.some(g => g.playoff);
      const hasKo = c.ko.main.length > 0;
      const fo = finalOrder(c, em);
      const secs: [typeof sec, string, boolean][] = [
        ['zoznam', 'Zoznam hráčov', c.entryIds.length > 0],
        ['skupiny', 'Skupiny', c.groups.length > 0 || !!c.finalGroup],
        ['playoff', 'Play-off 1‑2 / 3‑4', hasPo],
        ['pavuk', 'Pavúk — K.O.', hasKo],
        ['poradie', 'Poradie', fo.length > 0],
      ];
      const avail = secs.filter(x => x[2]);
      const cur = avail.some(x => x[0] === sec) ? sec : (avail[0]?.[0] ?? 'zoznam');

      if (c.type === 'teams') return <section className="card pub-card">
        <h2>{c.name} · {TEAM_SYSTEMS[c.teamSystemId || 'CORBILLON'].name}</h2>
        {c.teamTies.map(t => { const home = data.teams.find(x => x.id === t.homeTeamId), away = data.teams.find(x => x.id === t.awayTeamId); return <div className="pub-tie" key={t.id}>
          <div className="pub-tie-head"><strong>{home?.name}</strong><b>{t.homeScore} : {t.awayScore}</b><strong>{away?.name}</strong></div>
          {t.rubbers.map(r => <div className="pub-rubber" key={r.id}><span>{r.order}. {label(r.match.playerAId)} – {label(r.match.playerBId)}</span><span>{r.match.winnerId ? scoreText(r.match) : '—'}</span></div>)}
        </div>; })}
      </section>;

      return <section className="card pub-card">
        <div className="comp-head"><h2>{c.name}</h2>
          {avail.length > 1 && <nav className="sec-tabs">{avail.map(([k, lbl]) =>
            <button key={k} className={`sec-tab${cur === k ? ' active' : ''}`} onClick={() => setSec(k)}>{lbl}</button>)}</nav>}
        </div>

        {cur === 'zoznam' && (() => {
          const list = c.entryIds.map(id => em.get(id)).filter(Boolean);
          return <div className="table-scroll"><table><thead><tr><th>#</th><th>Účastník</th><th>Klub</th></tr></thead><tbody>
            {list.map((e, i) => <tr key={e!.id}><td>{i + 1}</td>
              <td><strong className="clickable-name" onClick={() => setCard({ comp: c, entryId: e!.id, name: e!.name })}>{e!.name}</strong></td>
              <td>{e!.club || '—'}</td></tr>)}
          </tbody></table></div>;
        })()}

        {cur === 'skupiny' && <>
          {c.finalGroup && <div className="pub-group pub-decisive">
            <h3>{c.finalGroup.name} <span className="decisive-tag">určuje poradie</span></h3>
            <GroupTable group={c.finalGroup} map={em} players={data.players}
              onName={e => setCard({ comp: c, entryId: e.id, name: e.name })}
              onMatch={(m, sa, sb) => setMo({ comp: c, em, m, event: 'Finálová skupina', groupName: c.finalGroup!.name, matchNo: `${sa} - ${sb}` })} />
            <div className="pub-matches">{c.finalGroup.matches.filter(m => m.winnerId).map(m => <PubMatch key={m.id} m={m} label={label} em={em} onClick={() => setMo({ comp: c, em, m, event: 'Finálová skupina', groupName: c.finalGroup!.name })} />)}</div>
          </div>}
          {c.groups.map(g => <div className="pub-group" key={g.id}>
            <h3>{g.name}</h3>
            <GroupTable group={g} map={em} players={data.players}
              onName={e => setCard({ comp: c, entryId: e.id, name: e.name })}
              onMatch={(m, sa, sb) => setMo({ comp: c, em, m, event: 'Skupiny', groupName: g.name, matchNo: `${sa} - ${sb}` })} />
            {(() => { const tts = tieTables(g, em); return tts.length > 0 ? <div className="minitables">
              {tts.map((rows, k) => <div className="minitable" key={k}><h4>Minitabuľka pri rovnosti</h4>
                <table><thead><tr><th>#</th><th>Účastník</th><th>Body</th><th>Sety</th><th>Lopt.</th></tr></thead><tbody>
                  {rows.map(r => <tr key={r.entry.id}><td>{r.position}</td><td><strong>{r.entry.name}</strong></td><td><b>{r.matchPoints}</b></td><td>{r.setsFor}:{r.setsAgainst}</td><td>{r.pointsFor}:{r.pointsAgainst}</td></tr>)}
                </tbody></table></div>)}
            </div> : null; })()}
            <div className="pub-matches">{g.matches.filter(m => m.winnerId).map(m => <PubMatch key={m.id} m={m} label={label} em={em} onClick={() => setMo({ comp: c, em, m, event: 'Skupiny', groupName: g.name })} />)}</div>
          </div>)}
        </>}

        {cur === 'playoff' && c.groups.filter(g => g.playoff).map(g => <div className="pub-playoff" key={g.id}><h4>{g.name}</h4>
          <div className="pub-matches">
            <div className="pub-po-row"><span className="pb-label">O 1. miesto</span>
              <PubMatch m={g.playoff!.final} label={label} em={em} onClick={() => setMo({ comp: c, em, m: g.playoff!.final, event: 'Play-off · o 1. miesto', groupName: g.name })} /></div>
            {g.playoff!.third && <div className="pub-po-row"><span className="pb-label">O 3. miesto</span>
              <PubMatch m={g.playoff!.third!} label={label} em={em} onClick={() => setMo({ comp: c, em, m: g.playoff!.third!, event: 'Play-off · o 3. miesto', groupName: g.name })} /></div>}
          </div></div>)}

        {cur === 'pavuk' && <>
          {bracketRounds(c.ko.main, c, em)}
          {c.ko.consolation.length > 0 && <><h3 className="bracket-title">Útecha</h3>{bracketRounds(c.ko.consolation, c, em)}</>}
        </>}

        {cur === 'poradie' && <div className="table-scroll"><table><thead><tr><th>#</th><th>Umiestnenie</th><th>Účastník</th><th>Klub</th>{c.points && <th>Body</th>}</tr></thead><tbody>
          {fo.map((r, i) => <tr key={r.entry.id} className={r.place <= 3 ? 'qualified-row' : ''}><td>{i + 1}</td><td><b>{r.placeLabel}</b></td><td><strong>{r.entry.name}</strong></td><td>{r.entry.club}</td>{c.points && <td>{c.points[r.placeLabel] ?? ''}</td>}</tr>)}
        </tbody></table></div>}
      </section>;
    })()}

    {tab === 'harmonogram' && (() => {
      const rows = data.competitions.flatMap(c => {
        const em = entryMap(c, data.players, data.pairs, data.teams);
        const lab = (id: string | null) => (id ? em.get(id)?.name || '—' : '—');
        return [
          ...c.groups.flatMap(g => g.matches.map(m => ({ c, phase: g.name, kind: 'Skupiny', m, lab }))),
          ...(c.finalGroup ? c.finalGroup.matches.map(m => ({ c, phase: c.finalGroup!.name, kind: 'Finálová skupina', m, lab })) : []),
          ...c.groups.flatMap(g => g.playoff ? [{ c, phase: `${g.name} · o 1.`, kind: 'Play-off', m: g.playoff.final, lab }, ...(g.playoff.third ? [{ c, phase: `${g.name} · o 3.`, kind: 'Play-off', m: g.playoff.third, lab }] : [])] : []),
          ...c.ko.main.flatMap(r => r.matches.map(m => ({ c, phase: r.name, kind: 'Pavúk', m, lab }))),
          ...c.ko.consolation.flatMap(r => r.matches.map(m => ({ c, phase: `Útecha · ${r.name}`, kind: 'Pavúk', m, lab }))),
        ];
      }).filter(x => x.m.scheduledTime).sort((a, b) => (a.m.scheduledTime || '').localeCompare(b.m.scheduledTime || '') || (a.m.table ?? 0) - (b.m.table ?? 0));
      const phases = ['Skupiny', 'Finálová skupina', 'Play-off', 'Pavúk'];
      return <section className="card pub-card"><h2>Časový harmonogram</h2>
        {rows.length === 0 ? <p className="muted">Harmonogram zatiaľ nie je zverejnený.</p> :
          phases.filter(ph => rows.some(r => r.kind === ph)).map(ph => <div key={ph} className="sched-phase">
            <h3 className="bracket-title">{ph}</h3>
            <div className="table-scroll"><table><thead><tr><th>Čas</th><th>Stôl</th><th>Súťaž</th><th>Fáza</th><th>Zápas</th><th>Výsledok</th></tr></thead><tbody>
              {rows.filter(r => r.kind === ph).map(({ c, phase, m, lab }) => <tr key={m.id}>
                <td><b>{m.scheduledTime}</b></td><td>{m.table ?? '—'}</td><td>{c.name}</td><td>{phase}</td>
                <td>{lab(m.playerAId)} – {lab(m.playerBId)}</td><td>{m.winnerId ? scoreText(m) : '—'}</td></tr>)}
            </tbody></table></div>
          </div>)}
      </section>;
    })()}

    <div className="pub-foot"><Link className="button" to={`/t/${slug}/admin`}><Settings size={16} />Spravovať (PIN)</Link></div>
    {mo && (() => { const A = mo.em.get(mo.m.playerAId || ''), B = mo.em.get(mo.m.playerBId || '');
      const side = (e?: GenericEntry): Side => ({ name: e?.name || '—', club: e?.club || '', photo: data.players.find(p => p.id === e?.id)?.photo });
      return <MatchOverview tournament={name} competition={mo.comp.name} event={mo.event} groupName={mo.groupName}
        date={data.settings.date} table={mo.m.table ?? null} matchNo={mo.matchNo}
        a={side(A)} b={side(B)} m={mo.m} onClose={() => setMo(null)} />; })()}
    {regOpen && <RegistrationForm slug={slug} tournament={name} categories={data.competitions.map(c => c.name)}
      onClose={() => setRegOpen(false)} onDone={() => { setRegOpen(false); setRegDone(true); loadExtras(); }} />}
    {card && <EntryCard competition={card.comp} entryId={card.entryId} name={card.name} label={label} avatar={data.players.find(p => p.id === card.entryId)?.photo} onClose={() => setCard(null)} />}
  </Shell>;
}

function PubMatch({ m, label, em, onClick }: { m: Match; label: (id: string | null) => string; em?: Map<string, GenericEntry>; onClick?: () => void }) {
  const detail = m.winnerId ? setsText(m) : '';
  const club = (id: string | null) => (id && em?.get(id)?.club) || '';
  return <div className={`pub-match${onClick ? ' pub-match-click' : ''}`} onClick={onClick}>
    <div className="pm-row">
      <span className={m.winnerId === m.playerAId ? 'win' : ''}>{label(m.playerAId)}<em className="pm-club">{club(m.playerAId)}</em></span>
      <b>{m.winnerId ? scoreText(m) : 'vs'}</b>
      <span className={m.winnerId === m.playerBId ? 'win' : ''}>{label(m.playerBId)}<em className="pm-club">{club(m.playerBId)}</em></span>
    </div>
    {detail && <div className="pm-sets">{detail}</div>}
  </div>;
}

function KMatch({ m, em, onClick }: { m: Match; em: Map<string, GenericEntry>; onClick: () => void }) {
  const nm = (id: string | null) => (id ? em.get(id)?.name || '—' : '—');
  const cl = (id: string | null) => (id ? em.get(id)?.club || '' : '');
  const sc = m.winnerId ? scoreText(m).split(':') : null;
  return <div className="kmatch" onClick={onClick}>
    <div className={`krow${m.winnerId === m.playerAId ? ' kwin' : ''}`}><span className="kname">{nm(m.playerAId)}<em>{cl(m.playerAId)}</em></span><b>{sc ? sc[0] : ''}</b></div>
    <div className={`krow${m.winnerId === m.playerBId ? ' kwin' : ''}`}><span className="kname">{nm(m.playerBId)}<em>{cl(m.playerBId)}</em></span><b>{sc ? sc[1] : ''}</b></div>
  </div>;
}
const hasSchedule = (cs: Competition[]) => cs.some(c => c.groups.some(g => g.matches.some(m => m.scheduledTime)));

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="public-shell">
    <header className="public-top">
      <Link className="brand-line" to="/"><img className="brand-logo-sm" src="/topspin.png" alt="TOPSPIN" /><strong>TOPSPIN</strong></Link>
      <AuthBar />
    </header>
    <main className="public-main">{children}</main>
  </div>;
}
