import { LayoutDashboard, Users, UserRoundCog, Trophy, Layers3, TableProperties, GitBranch, CalendarClock, Shield, FileDown } from 'lucide-react';
import type { View } from '../types';
const items: [View, string, any][] = [
  ['dashboard', 'Prehľad', LayoutDashboard],
  ['players', 'Hráči', Users],
  ['entries', 'Páry a družstvá', UserRoundCog],
  ['competitions', 'Súťaže', Trophy],
  ['groups', 'Skupiny', Layers3],
  ['results', 'Výsledky skupín', TableProperties],
  ['knockout', 'Pavúky', GitBranch],
  ['schedule', 'Harmonogram', CalendarClock],
  ['teams', 'Družstvá', Shield],
  ['exports', 'Tlač a export', FileDown],
];
export function Sidebar({ active, onChange, playerCount, groupCount }: { active: View; onChange: (v: View) => void; playerCount: number; groupCount: number }) {
  return <aside className="sidebar"><a className="brand" href="/" title="Späť na zoznam turnajov"><img className="brand-logo" src="/topspin.png" alt="TOPSPIN" /><div><strong>TOPSPIN</strong><span>← Turnaje</span></div></a>
    <nav>{items.map(([v, l, I]) => <button key={v} className={active === v ? 'active' : ''} onClick={() => onChange(v)}><I size={19} />{l}</button>)}</nav>
    <div className="sidebar-stats"><strong>{playerCount}</strong><span>hráčov</span><strong>{groupCount}</strong><span>skupín</span></div>
  </aside>;
}
