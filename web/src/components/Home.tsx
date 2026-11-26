import { categories } from '../dialogue/catalog';
import { href } from '../route';
import { AudioChip, Icon, TabBar } from './common';

export function Home() {
  return <div className="app">
    <div className="app-body">
      <header className="screen-head">
        <h1>Practice</h1>
        <p>Mandarin conversations · hear it, pick a reply, say it aloud</p>
      </header>
      <a className="search-pill" href={href.find()}><Icon name="search" /><span>Heard something? Find a phrase</span></a>
      <AudioChip />
      {categories.map(c => <section key={c.id} className="section" aria-labelledby={`cat-${c.id}`}>
        <h2 id={`cat-${c.id}`} className="section-label">{c.title}</h2>
        <ul className="tiles">{c.scenarios.map(s => <li key={s.id}>
          <a className="tile" href={href.play(s.id)}>
            <span className="tile-icon" aria-hidden="true">{s.icon}</span>
            <span className="tile-title">{s.title}</span>
            <span className="tile-meta">{Object.values(s.nodes).filter(n => !n.choices.length).length} endings</span>
          </a>
        </li>)}</ul>
      </section>)}
    </div>
    <TabBar active="home" />
  </div>;
}
