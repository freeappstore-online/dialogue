import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { audioPath } from './audio';
import { categories, phrases, repairs, scenarios } from './catalog';
import { applyRepair, nextNode, pathTo, validateScenario, walk, type Scenario } from './model';
import { parseRoute, href } from '../route';

const endings = (s: Scenario) => Object.entries(s.nodes).filter(([, n]) => !n.choices.length);

describe('scenario catalog', () => {
  it('groups focused, independently launchable trees by category', () => {
    expect(categories.map(c => c.title)).toEqual(['Restaurant / Food', 'Directions', 'Appointments']);
    expect(categories[0].scenarios.map(s => s.id)).toEqual(['restaurant-arrival', 'restaurant-ordering', 'restaurant-bill']);
    // The bill tree starts at the bill, not at arrival or ordering.
    expect(categories[0].scenarios[2].nodes[categories[0].scenarios[2].start].zh).toBe('还需要点别的吗？');
  });

  for (const s of scenarios) describe(s.id, () => {
    it('is valid: every node reachable, every edge resolves, every line has pinyin and meaning', () => {
      validateScenario(s);
      for (const n of Object.values(s.nodes)) {
        for (const line of [n, ...n.choices, ...(n.variants ?? []), ...(n.rephrase ? [n.rephrase] : [])]) {
          expect(line.pinyin).toMatch(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/);
          expect(line.pinyin).not.toMatch(/\?\?/);
        }
      }
    });

    it('has no cycles, and every path ends at an ending with an outcome', () => {
      const visit = (id: string, path: string[]): number => {
        expect(path).not.toContain(id);
        const n = s.nodes[id];
        if (!n.choices.length) { expect(n.outcome).toBeTruthy(); return 1; }
        return n.choices.reduce((sum, c) => sum + visit(nextNode(s, id, c.id), [...path, id]), 0);
      };
      expect(visit(s.start, [])).toBeGreaterThanOrEqual(5);
    });

    it('is a substantial multi-turn tree with several realistic endings', () => {
      expect(Object.keys(s.nodes).length).toBeGreaterThanOrEqual(10);
      expect(endings(s).length).toBeGreaterThanOrEqual(3);
      expect(s.nodes[s.start].choices.length).toBeGreaterThanOrEqual(3);
      const depth = (id: string): number => Math.max(0, ...s.nodes[id].choices.map(c => 1 + depth(c.next)));
      expect(depth(s.start)).toBeGreaterThanOrEqual(3);
    });
  });

  it('includes the directions and appointment examples from the brief', () => {
    const subway = scenarios.find(s => s.id === 'directions-subway')!;
    expect(subway.nodes[subway.start].zh).toBe('你要去哪儿？');
    expect(subway.nodes[subway.start].choices.map(c => c.en)).toEqual(['To the train station', "I'm looking for the exit", "I'm not sure which line to take"]);
    const book = scenarios.find(s => s.id === 'appointment-book')!;
    expect(book.nodes.when.zh).toBe('好的。你想约几点？');
    expect(book.nodes.when.choices.map(c => c.en)).toEqual(['Tomorrow morning', 'Any time after three', 'What times are available?']);
    expect(book.nodes['morning-full'].en).toMatch(/fully booked/);
  });

  it('routes conversations by choice path; every node has a path from the start', () => {
    for (const s of scenarios) for (const id of Object.keys(s.nodes)) expect(walk(s, pathTo(s, id)).nodeId).toBe(id);
    expect(parseRoute(href.play('restaurant-ordering', ['recommend', 'spicy']))).toMatchObject({ view: 'play', nodeId: 'pork-spicy', path: ['recommend', 'spicy'] });
    expect(parseRoute('#/play/restaurant-ordering/recommend/bogus/x')).toMatchObject({ nodeId: 'recommend', path: ['recommend'] });
    expect(parseRoute('#/play/nope')).toEqual({ view: 'home' });
    expect(parseRoute('#access_token=abc')).toEqual({ view: 'home' });
  });

  it('rejects broken graphs', () => {
    const bad = structuredClone(scenarios[0]);
    bad.nodes[bad.start].choices[0].next = 'missing';
    expect(() => validateScenario(bad)).toThrow();
    const orphan = structuredClone(scenarios[0]);
    orphan.nodes.lonely = { speaker: 'Host', zh: '你好。', pinyin: 'Nǐ hǎo.', en: 'Hi.', outcome: 'x', choices: [] };
    expect(() => validateScenario(orphan)).toThrow(/Unreachable/);
    const noOutcome = structuredClone(scenarios[0]);
    const [endId] = endings(noOutcome)[0];
    delete noOutcome.nodes[endId].outcome;
    expect(() => validateScenario(noOutcome)).toThrow(/outcome/);
    expect(() => nextNode(scenarios[0], scenarios[0].start, 'missing')).toThrow();
  });

  it('has a prerecorded file for every line, reply, repair and phrase', () => {
    const missing: string[] = [];
    const want = (voice: 'them' | 'you', zh: string) => { if (!existsSync(new URL(`../../public/${audioPath(voice, zh)}`, import.meta.url))) missing.push(`${voice}:${zh}`); };
    for (const s of scenarios) for (const n of Object.values(s.nodes)) {
      want('them', n.zh);
      n.variants?.forEach(v => want('them', v.zh));
      if (n.rephrase) want('them', n.rephrase.zh);
      n.choices.forEach(c => want('you', c.zh));
    }
    for (const r of repairs) { want('you', r.zh); want('them', r.response.zh); }
    for (const p of phrases) { want('them', p.zh); p.replies.forEach(r => want('you', r.zh)); }
    expect(missing).toEqual([]);
  });
});

describe('conversation repair', () => {
  const s = scenarios.find(x => x.id === 'restaurant-ordering')!;
  const node = s.nodes.order;
  const byId = (id: string) => repairs.find(r => r.id === id)!;

  it('offers the starter repair phrases', () => {
    expect(repairs.map(r => r.en)).toEqual(['Excuse me', "I'm not sure", "I didn't catch that", "I don't understand", 'Could you repeat that?', 'Could you speak more slowly?', 'Could you say it a different way?', 'Could you say that in English?']);
  });

  it('repeat and slower replay the same line and stay on the same turn', () => {
    expect(applyRepair(node, byId('repeat'))).toMatchObject({ replay: node });
    expect(applyRepair(node, byId('slower'))).toMatchObject({ replay: node, rate: 0.7 });
    for (const r of repairs) expect(applyRepair(node, r)).not.toHaveProperty('next');
  });

  it('rephrase plays the authored alternate line, or gives a manual fallback', () => {
    expect(applyRepair(node, byId('different')).replay).toBe(node.rephrase);
    const plain = s.nodes['pork-spicy'];
    expect(plain.rephrase).toBeUndefined();
    const outcome = applyRepair(plain, byId('dont-understand'));
    expect(outcome.replay).toBeUndefined();
    expect(outcome.fallback).toMatch(/No other wording/);
  });

  it('asking for English reveals the authored meaning without pretending to translate', () => {
    const outcome = applyRepair(node, byId('english'));
    expect(outcome.revealMeaning).toBe(true);
    expect(outcome.response?.en).toMatch(/English isn't very good/);
  });
});
