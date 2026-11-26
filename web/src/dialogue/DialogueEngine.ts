import raw from './graph.json';
export type Choice = { id: string; zh: string; pinyin: string; en: string; next: string };
export type Node = { speaker: string; zh: string; pinyin: string; en: string; audio: string; choices: Choice[] };
export type Graph = { version: string; scenario: string; start: string; nodes: Record<string, Node> };
export function validateGraph(graph: Graph): void {
  if (!graph.version || !graph.scenario || !graph.nodes?.[graph.start]) throw new Error('Invalid graph metadata or start node');
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (!node.zh || !node.pinyin || !node.en || !node.audio || !Array.isArray(node.choices)) throw new Error(`Invalid node: ${id}`);
    const ids = new Set<string>();
    for (const choice of node.choices) {
      if (!choice.id || ids.has(choice.id) || !choice.zh || !choice.pinyin || !choice.en || !graph.nodes[choice.next]) throw new Error(`Invalid choice in ${id}`);
      ids.add(choice.id);
    }
  }
}
export const graph: Graph = raw;
validateGraph(graph);
export class DialogueEngine {
  currentId: string;
  constructor(public readonly graph: Graph = raw) { validateGraph(graph); this.currentId = graph.start; }
  get current(): Node { return this.graph.nodes[this.currentId]; }
  advance(choiceId: string): void {
    const choice = this.current.choices.find(c => c.id === choiceId);
    if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
    this.currentId = choice.next;
  }
  restart(): void { this.currentId = this.graph.start; }
}
