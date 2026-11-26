import { useMemo, useState } from 'react';
import { phrases, scenarioById, scenarios } from '../dialogue/catalog';
import { buildEntries, likely, matchTranscripts, search, type Entry } from '../dialogue/finder';
import { href } from '../route';
import { LineBlock, ListenButton, PlayButton } from './common';

function EntryItem({ entry, label }: { entry: Entry; label?: string }) {
  const [open, setOpen] = useState(false);
  return <li className="entry">
    <button type="button" className="entry-head" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span className="entry-zh" lang="zh-CN">{entry.zh}</span>
      <span className="pinyin">{entry.pinyin}</span>
      <span className="translation">{entry.en}</span>
      <span className="muted small">{label && <strong className="badge">{label}</strong>} {entry.source ? entry.source.title : 'Common phrase'}</span>
    </button>
    {open && <div className="entry-body">
      <p><PlayButton voice="them" zh={entry.zh} label={`Play: ${entry.en}`} /> Hear it</p>
      <h3>Replies you can use</h3>
      {entry.replies.length ? entry.replies.map(r => <LineBlock key={r.zh} line={r} voice="you" />) : <p className="muted">This line ends the conversation.</p>}
      {entry.source && <a className="secondary" href={href.play(entry.source.scenarioId, entry.source.nodeId)}>Practise this conversation from here</a>}
    </div>}
  </li>;
}

export function Finder({ scenarioId, nodeId }: { scenarioId?: string; nodeId?: string }) {
  const entries = useMemo(() => buildEntries(scenarios, phrases), []);
  const ctx = { scenarioId, nodeId };
  const [query, setQuery] = useState('');
  const [heard, setHeard] = useState<string[] | null>(null);
  const scenario = scenarioById(scenarioId);
  const matches = heard ? matchTranscripts(entries, heard, ctx) : null;
  const results = query.trim() ? search(entries, query, ctx).slice(0, 40) : null;
  return <div className="dialogue">
    <a className="back" href={scenario && nodeId ? href.play(scenario.id, nodeId) : href.home}>{scenario ? `← Back to ${scenario.title}` : '← All conversations'}</a>
    <header className="intro"><span className="eyebrow">QUICK REFERENCE</span><h1>Find a phrase</h1><p>Heard someone say something? Find it by meaning, Mandarin or pinyin, then read replies you can use. Nothing here moves a conversation forward on its own.</p></header>
    <div className="search">
      <label htmlFor="find-q">Search by meaning, Mandarin or pinyin</label>
      <input id="find-q" type="search" value={query} autoComplete="off" placeholder="e.g. which line, 几号线, ji hao xian" onChange={e => { setQuery(e.target.value); setHeard(null); }} />
    </div>
    <ListenButton label="Listen for one phrase" onHeard={alts => { setHeard(alts); setQuery(''); }} />

    {matches && heard && <section className="results" aria-live="polite">
      <h2>Heard: “<span lang="zh-CN">{heard[0]}</span>”</h2>
      {heard.length > 1 && <p className="muted small">Other transcripts: {heard.slice(1).map(h => `“${h}”`).join(', ')}</p>}
      {!matches.length && <p>No prepared line matches what was heard. Try searching by meaning, or browse below.</p>}
      {matches.length > 1 && !matches[0].exact && <p className="muted small">Several lines are similar — check the meaning before you reply.</p>}
      <ul className="entries">{matches.map(m => <EntryItem key={m.entry.key} entry={m.entry} label={m.exact ? 'Exact text match' : 'Possible match'} />)}</ul>
      <button type="button" className="link" onClick={() => setHeard(null)}>Clear</button>
    </section>}

    {results && <section className="results" aria-live="polite">
      <h2>{results.length ? `${results.length} matching line${results.length === 1 ? '' : 's'}` : 'No matches'}</h2>
      {!results.length && <p>Try fewer words, the English meaning, or pinyin without tones.</p>}
      <ul className="entries">{results.map(e => <EntryItem key={e.key} entry={e} />)}</ul>
    </section>}

    {!results && !matches && <>
      <section className="results">
        <h2>{scenario ? 'Likely right now, then common phrases' : 'Common phrases'}</h2>
        <ul className="entries">{likely(entries, ctx).map(e => <EntryItem key={e.key} entry={e} />)}</ul>
      </section>
      <section className="results">
        <h2>Browse by conversation</h2>
        {scenarios.map(s => <details key={s.id} className="browse"><summary>{s.title}</summary>
          <ul className="entries">{entries.filter(e => e.source?.scenarioId === s.id).map(e => <EntryItem key={e.key} entry={e} />)}</ul>
        </details>)}
      </section>
    </>}
  </div>;
}
