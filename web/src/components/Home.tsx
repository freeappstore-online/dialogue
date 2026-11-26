import { categories } from '../dialogue/catalog';
import { href } from '../route';
import { AudioNotice } from './common';

export function Home() {
  return <div className="dialogue">
    <header className="intro"><span className="eyebrow">MANDARIN · CONVERSATION PRACTICE</span><h1>Real conversations, one turn at a time</h1><p>Hear what someone says, choose what you mean, and say your reply aloud. Each situation is short and can be started on its own.</p></header>
    <AudioNotice />
    <a className="finder-link" href={href.find()}>Heard something? Find a phrase and ready replies →</a>
    {categories.map(c => <section key={c.id} className="category" aria-labelledby={`cat-${c.id}`}>
      <h2 id={`cat-${c.id}`}>{c.title}</h2>
      <ul className="scenario-list">{c.scenarios.map(s => <li key={s.id} className="scenario">
        <h3>{s.title}</h3><p>{s.summary}</p>
        <div className="row"><a className="primary inline" href={href.play(s.id)} aria-label={`Practise: ${s.title}`}>Practise</a><a className="secondary" href={href.script(s.id)} aria-label={`Script and quick reference: ${s.title}`}>Script &amp; quick reference</a></div>
      </li>)}</ul>
    </section>)}
  </div>;
}
