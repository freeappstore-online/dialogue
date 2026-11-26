import { describe, expect, it } from 'vitest';
import { DialogueEngine, graph, validateGraph } from './DialogueEngine';
import { readFileSync } from 'node:fs';

describe('restaurant graph', () => {
  it('has a valid start and pinyin on every node and reply', () => { validateGraph(graph); expect(graph.nodes[graph.start]).toBeDefined(); for (const node of Object.values(graph.nodes)) { expect(node.pinyin).toBeTruthy(); expect(node.zh).toMatch(/[\u4e00-\u9fff]/); expect(node.pinyin).not.toMatch(/\?\?/); for (const choice of node.choices) expect(choice.pinyin).toBeTruthy(); } });
  it('reaches an ending through a full path', () => { const engine = new DialogueEngine(); engine.advance('one'); engine.advance('recommend'); engine.advance('accept'); expect(engine.currentId).toBe('pork-end'); expect(engine.current.choices).toHaveLength(0); engine.restart(); expect(engine.currentId).toBe(graph.start); });
  it('has valid edges and every branch reaches an ending', () => { const visit = (id: string, ancestors: string[]) => { expect(ancestors).not.toContain(id); const node = graph.nodes[id]; expect(node).toBeDefined(); for (const choice of node.choices) visit(choice.next, [...ancestors, id]); }; visit(graph.start, []); });
  it('rejects invalid choices and missing targets', () => { const engine = new DialogueEngine(); expect(() => engine.advance('missing')).toThrow(); const bad = structuredClone(graph); bad.nodes.greet.choices[0].next = 'missing'; expect(() => validateGraph(bad)).toThrow(); });
  it('keeps the offline graph copy in sync', () => { expect(JSON.parse(readFileSync(new URL('../../public/dialogue/graph.json', import.meta.url), 'utf8'))).toEqual(graph); });
});


