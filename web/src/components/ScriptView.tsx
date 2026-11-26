import { StatusBar } from '@freeappstore/sdk/ui';
import { categoryOf } from '../dialogue/catalog';
import { pathTo, type Scenario } from '../dialogue/model';
import { href } from '../route';
import { LineBlock, TopBar } from './common';

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
  return <div className="app">
    <TopBar back={href.play(scenario.id)} backLabel="Back to the conversation" title="Full script" subtitle={`${scenario.icon} ${scenario.title} · ${categoryOf(scenario).title}`} />
    <div className="app-body">
      <ol className="script">{order.map(id => {
        const n = scenario.nodes[id];
        return <li key={id} id={`node-${id}`} tabIndex={-1} className="script-node">
          <div className="script-head"><span className="step">{num[id]}</span><span className="bubble-speaker">{n.speaker}</span><a className="text-btn" href={href.play(scenario.id, pathTo(scenario, id))}>Practise from here</a></div>
          <LineBlock line={n} voice="them" />
          {!!n.variants?.length && <div className="also"><h3 className="section-label">Also heard as</h3>{n.variants.map(v => <LineBlock key={v.zh} line={v} voice="them" />)}</div>}
          {n.rephrase && <div className="also"><h3 className="section-label">Said another way</h3><LineBlock line={n.rephrase} voice="them" /></div>}
          {n.choices.length
            ? <div className="also"><h3 className="section-label">Replies</h3><ul className="script-replies">{n.choices.map(c => <li key={c.id}><LineBlock line={c} voice="you" /><button type="button" className="text-btn" onClick={() => jump(c.next)}>Leads to {num[c.next]}</button></li>)}</ul></div>
            : <p className="outcome">🎉 {n.outcome}</p>}
        </li>;
      })}</ol>
    </div>
    <div className="dock"><StatusBar /></div>
  </div>;
}
