/** A Mandarin line with tone-marked pinyin and an English meaning. */
export type Line = { zh: string; pinyin: string; en: string };
export type Choice = Line & { id: string; next: string };
export type DialogueNode = Line & {
  speaker: string;
  choices: Choice[];
  /** Other ways the same thing is commonly said; used by the phrase finder. */
  variants?: Line[];
  /** Authored alternate wording, played when the learner asks to say it differently. */
  rephrase?: Line;
  /** Required on endings: what happened. */
  outcome?: string;
};
export type Scenario = {
  id: string;
  version: string;
  category: string;
  icon: string;
  title: string;
  summary: string;
  start: string;
  nodes: Record<string, DialogueNode>;
};
export type RepairAction = 'wait' | 'repeat' | 'slower' | 'rephrase' | 'english';
export type Repair = Line & { id: string; action: RepairAction; response: Line };
export type Phrase = Line & { id: string; replies: Line[] };

const hasLine = (line?: Partial<Line>) => !!line?.zh && !!line.pinyin && !!line.en && /[一-鿿]/.test(line.zh);

export function validateScenario(s: Scenario): void {
  if (!s.id || !s.version || !s.category || !s.icon || !s.title || !s.summary || !s.nodes?.[s.start]) throw new Error(`Invalid scenario metadata: ${s.id}`);
  for (const [id, node] of Object.entries(s.nodes)) {
    const where = `${s.id}/${id}`;
    if (!hasLine(node) || !node.speaker || !Array.isArray(node.choices)) throw new Error(`Invalid node: ${where}`);
    if (!node.choices.length && !node.outcome) throw new Error(`Ending without outcome: ${where}`);
    if (node.rephrase && !hasLine(node.rephrase)) throw new Error(`Invalid rephrase: ${where}`);
    if (node.variants?.some(v => !hasLine(v))) throw new Error(`Invalid variant: ${where}`);
    const ids = new Set<string>();
    for (const choice of node.choices) {
      if (!choice.id || ids.has(choice.id) || !hasLine(choice) || !s.nodes[choice.next]) throw new Error(`Invalid choice in ${where}`);
      ids.add(choice.id);
    }
  }
  const seen = new Set<string>();
  const stack = [s.start];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const choice of s.nodes[id].choices) stack.push(choice.next);
  }
  const orphans = Object.keys(s.nodes).filter(id => !seen.has(id));
  if (orphans.length) throw new Error(`Unreachable nodes in ${s.id}: ${orphans.join(', ')}`);
}

/** Follow choice ids from the start; stops at the first id that doesn't apply. */
export function walk(s: Scenario, path: string[]): { nodeId: string; path: string[] } {
  let nodeId = s.start;
  const valid: string[] = [];
  for (const id of path) {
    const choice = s.nodes[nodeId].choices.find(c => c.id === id);
    if (!choice) break;
    valid.push(id);
    nodeId = choice.next;
  }
  return { nodeId, path: valid };
}

/** Shortest choice path from the start to a node. */
export function pathTo(s: Scenario, target: string): string[] {
  const prev = new Map<string, { from: string; choice: string }>();
  const queue = [s.start];
  for (let i = 0; i < queue.length && queue[i] !== target; i++) {
    for (const c of s.nodes[queue[i]].choices) {
      if (c.next === s.start || prev.has(c.next)) continue;
      prev.set(c.next, { from: queue[i], choice: c.id });
      queue.push(c.next);
    }
  }
  const path: string[] = [];
  for (let id = target; id !== s.start; id = prev.get(id)!.from) path.unshift(prev.get(id)!.choice);
  return path;
}

export function nextNode(s: Scenario, nodeId: string, choiceId: string): string {
  const choice = s.nodes[nodeId]?.choices.find(c => c.id === choiceId);
  if (!choice) throw new Error(`Unknown choice: ${nodeId}/${choiceId}`);
  return choice.next;
}

/** A repair is an interruption of the present turn: it never names a next node. */
export type RepairOutcome = { response?: Line; replay?: Line; rate?: number; revealMeaning?: boolean; fallback?: string };

export function applyRepair(node: DialogueNode, repair: Repair): RepairOutcome {
  switch (repair.action) {
    case 'wait': return { response: repair.response };
    case 'repeat': return { response: repair.response, replay: node };
    case 'slower': return { response: repair.response, replay: node, rate: 0.7 };
    case 'english': return { response: repair.response, revealMeaning: true };
    case 'rephrase': return node.rephrase
      ? { response: repair.response, replay: node.rephrase }
      : { fallback: 'No other wording is prepared for this line. Ask them to speak more slowly, or show the English meaning.' };
  }
}
