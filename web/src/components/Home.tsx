import { categories } from '../dialogue/catalog';
import { href } from '../route';
import { AudioChip, Icon, SettingsButton, TabBar } from './common';

export function Home() {
  return <div className="app">
    <div className="app-body">
      <header className="screen-head">
        <div className="screen-title"><h1 tabIndex={-1} data-fas-page-heading="">Practice</h1><SettingsButton /></div>
        <p>Short, real-life Mandarin conversations.</p>
      </header>
      <ol className="how" aria-label="How it works">
        <li><span aria-hidden="true">👂</span><span><strong>Listen</strong> to what they say</span></li>
        <li><span aria-hidden="true">👆</span><span><strong>Pick</strong> what you want to say</span></li>
        <li><span aria-hidden="true">🗣️</span><span><strong>Say it</strong> in Mandarin, then send</span></li>
      </ol>
      <a className="search-pill" href={href.find()}><Icon name="search" /><span>Heard something? Find a phrase</span></a>
      <AudioChip />
      {categories.map(c => <section key={c.id} className="section" aria-labelledby={`cat-${c.id}`}>
        <h2 id={`cat-${c.id}`} className="section-label">{c.title}</h2>
        <ul className="tiles">{c.scenarios.map(s => <li key={s.id}>
          <a className="tile" href={href.play(s.id)}>
            <span className="tile-icon" aria-hidden="true">{s.icon}</span>
            <span className="tile-title">{s.title}</span>
            <span className="tile-meta">{s.summary}</span>
          </a>
        </li>)}</ul>
      </section>)}
    </div>
    <TabBar active="home" />
  </div>;
}
