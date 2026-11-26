import { categoryOf } from '../dialogue/catalog';
import type { Scenario } from '../dialogue/model';
import { href } from '../route';
import { LineBlock } from './common';

/** Nodes in breadth-first order from the start, so the script reads top to bottom. */
export function scriptOrder(s: Scenario): string[] {
  const order = [s.start];
  for (let i = 0; i < order.length; i++) for (const c of s.nodes[order[i]].choices) if (!order.includes(c.next)) order.push(c.next);
  return order;
}

const jump = (id: string) => {
  const el = document.getElementById(`node-${id}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el?.focus({ preventScroll: true });
};

export function ScriptView({ scenario }: { scenario: Scenario }) {
  const order = scriptOrder(scenario);
  const num = Object.fromEntries(order.map((id, i) => [id, i + 1]));
  return <div className="dialogue">
    <a className="back" href={href.home}>← All conversations</a>
    <header className="intro"><span className="eyebrow">SCRIPT · {categoryOf(scenario).title.toUpperCase()}</span><h1>{scenario.title}</h1><p>Every line with pinyin and meaning, and where each reply leads. Use it as a quick reference: find what was just said and read the prepared replies.</p></header>
    <div className="row"><a className="primary inline" href={href.play(scenario.id)}>Practise from the start</a></div>
    <ol className="script">{order.map(id => {
      const n = scenario.nodes[id];
      return <li key={id} id={`node-${id}`} tabIndex={-1} className="script-node">
        <div className="card-top"><span className="speaker">#{num[id]} · {n.speaker.toUpperCase()}</span><a className="small" href={href.play(scenario.id, id)}>Practise from here</a></div>
        <LineBlock line={n} voice="them" />
        {!!n.variants?.length && <div className="also"><h3>Also heard as</h3>{n.variants.map(v => <LineBlock key={v.zh} line={v} voice="them" />)}</div>}
        {n.rephrase && <div className="also"><h3>Said another way (when you ask)</h3><LineBlock line={n.rephrase} voice="them" /></div>}
        {n.choices.length
          ? <div className="also"><h3>Replies</h3><ul className="script-replies">{n.choices.map(c => <li key={c.id}><LineBlock line={c} voice="you" /><button type="button" className="link" onClick={() => jump(c.next)}>leads to #{num[c.next]}</button></li>)}</ul></div>
          : <p className="outcome"><strong>Ending:</strong> {n.outcome}</p>}
      </li>;
    })}</ol>
  </div>;
}
