import { useMemo, useState } from 'react';
import { phrases, scenarioById, scenarios } from '../dialogue/catalog';
import { buildEntries, likely, matchTranscripts, search, type Entry } from '../dialogue/finder';
import { pathTo } from '../dialogue/model';
import { href } from '../route';
import { Icon, LineBlock, ListenButton, PlayButton, SettingsButton, Sheet, TabBar } from './common';
import { useDisplay, Zh } from './prefs';

function EntryRow({ entry, label, onOpen }: { entry: Entry; label?: string; onOpen: (e: Entry) => void }) {
  return <li><button type="button" className="list-row" onClick={() => onOpen(entry)}>
    <span className="list-main">
      <strong className="row-zh"><Zh line={entry} /></strong>
      <span>{entry.en}</span>
      {label && <span className={`tag ${label === 'Exact text match' ? 'ok' : ''}`}>{label}</span>}
    </span>
    <Icon name="chevron" />
  </button></li>;
}

export function Finder({ scenarioId, path = [], nodeId }: { scenarioId?: string; path?: string[]; nodeId?: string }) {
  const entries = useMemo(() => buildEntries(scenarios, phrases), []);
  const ctx = { scenarioId, nodeId };
  const [query, setQuery] = useState('');
  const [heard, setHeard] = useState<string[] | null>(null);
  const [open, setOpen] = useState<Entry | null>(null);
  const [listenError, setListenError] = useState('');
  const [browsing, setBrowsing] = useState<Record<string, boolean>>({});
  const scenario = scenarioById(scenarioId);
  const matches = heard ? matchTranscripts(entries, heard, ctx) : null;
  const results = query.trim() ? search(entries, query, ctx).slice(0, 40) : null;
  const source = open?.source && scenarioById(open.source.scenarioId);
  const [{ playThem }] = useDisplay();

  return <div className="app">
    <div className="app-body">
      <header className="screen-head">
        <div className="screen-title"><h1 tabIndex={-1} data-fas-page-heading="">Phrases</h1><SettingsButton /></div>
        <p>Find what someone said and see replies you can use</p>
      </header>
      {scenario && <a className="context-chip" href={href.play(scenario.id, path)}><Icon name="back" /> Back to {scenario.icon} {scenario.title}</a>}
      <div className="search-field">
        <Icon name="search" />
        <label htmlFor="find-q" className="sr-only">Search by meaning, Mandarin or pinyin</label>
        <input id="find-q" type="search" value={query} autoComplete="off" placeholder="Meaning, 汉字 or pinyin" onChange={e => { setQuery(e.target.value); setHeard(null); }} />
        <ListenButton compact label="Listen for one phrase" onHeard={alts => { setHeard(alts); setQuery(''); setListenError(''); }} onError={setListenError} />
      </div>
      {listenError && <p className="hint-text" role="status">{listenError}</p>}

      {matches && heard && <section className="section" aria-live="polite">
        <div className="section-head"><h2 className="section-label">Heard “<span lang="zh-CN">{heard[0]}</span>”</h2><button type="button" className="text-btn" onClick={() => setHeard(null)}>Clear</button></div>
        {heard.length > 1 && <p className="hint-text">Other transcripts: {heard.slice(1).map(h => `“${h}”`).join(', ')}</p>}
        {!matches.length && <p className="empty">No prepared line matches. Try searching by meaning, or browse below.</p>}
        {matches.length > 1 && !matches[0].exact && <p className="hint-text">Several lines are similar — check the meaning before you reply.</p>}
        <ul className="list">{matches.map(m => <EntryRow key={m.entry.key} entry={m.entry} label={m.exact ? 'Exact text match' : 'Possible match'} onOpen={setOpen} />)}</ul>
      </section>}

      {results && <section className="section" aria-live="polite">
        <h2 className="section-label">{results.length ? `${results.length} result${results.length === 1 ? '' : 's'}` : 'No results'}</h2>
        {!results.length && <p className="empty">Try fewer words, the English meaning, or pinyin without tones.</p>}
        <ul className="list">{results.map(e => <EntryRow key={e.key} entry={e} onOpen={setOpen} />)}</ul>
      </section>}

      {!results && !matches && <>
        <section className="section">
          <h2 className="section-label">{scenario ? 'Likely right now' : 'Common phrases'}</h2>
          <ul className="list">{likely(entries, ctx).map(e => <EntryRow key={e.key} entry={e} onOpen={setOpen} />)}</ul>
        </section>
        <section className="section">
          <h2 className="section-label">By conversation</h2>
          <div className="list">{scenarios.map(s => <details key={s.id} className="list-group" onToggle={e => { const shown = e.currentTarget.open; setBrowsing(b => ({ ...b, [s.id]: shown })); }}><summary className="list-row"><span className="list-main"><strong>{s.icon} {s.title}</strong></span><Icon name="chevron" /></summary>
            {/* Rendered only while open: each row lays out pinyin over its characters. */}
            {browsing[s.id] && <ul className="list nested">{entries.filter(e => e.source?.scenarioId === s.id).map(e => <EntryRow key={e.key} entry={e} onOpen={setOpen} />)}</ul>}
          </details>)}</div>
        </section>
      </>}
    </div>
    <TabBar active="find" />

    <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.source ? open.source.title : 'Common phrase'}>
      {open && <>
        <div className="detail-line">
          <p className="detail-text"><Zh line={open} className="detail-zh" /></p>
          <p className="meaning">{open.en}</p>
          {playThem && <PlayButton voice="them" line={open} label={`Play: ${open.en}`} />}
          {source && open.source && <a className="btn primary detail-action" href={href.play(source.id, pathTo(source, open.source.nodeId))}>Practise from here</a>}
        </div>
        <h3 className="section-label">Replies you can use</h3>
        {open.replies.length ? open.replies.map(r => <LineBlock key={r.zh} line={r} voice="you" meaning />) : <p className="hint-text">This line ends the conversation.</p>}
      </>}
    </Sheet>
  </div>;
}
