// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scenarioById } from '../dialogue/catalog';
import { walk } from '../dialogue/model';
import { DialoguePlayer } from './DialoguePlayer';
import { Finder } from './Finder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let host: HTMLElement;

beforeEach(() => {
  // No audio device and no speech recognition: the manual path must still work.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('no audio'));
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); localStorage.clear(); window.location.hash = ''; vi.restoreAllMocks(); });

const render = async (el: React.ReactElement) => { await act(async () => root.render(el)); };
const button = (text: string | RegExp) => [...host.querySelectorAll('button')].find(b => (typeof text === 'string' ? b.textContent?.includes(text) : text.test(b.textContent ?? '')))!;
const click = async (el: Element) => { await act(async () => (el as HTMLElement).click()); };

const play = async (id: string, path: string[] = []) => {
  const s = scenarioById(id)!;
  await render(<DialoguePlayer scenario={s} path={path} nodeId={walk(s, path).nodeId} />);
};
const help = async () => click(button(/^Help$/));

it('plays a turn manually with no microphone and no audio', async () => {
  await play('restaurant-ordering');
  expect(host.querySelector('.bubble-row.current')?.textContent).toContain('请问您想点什么？');
  await click(button('What do you recommend?'));
  expect(host.querySelector('[aria-label="Check my reply (optional)"]')).toBeNull();
  await click(button('Show the Mandarin'));
  expect(host.querySelector('.composer')?.textContent).toContain('你们有什么推荐？');
  await click(button('Send'));
  expect(window.location.hash).toBe('#/play/restaurant-ordering/recommend');
});

it('rebuilds the whole thread from the path', async () => {
  await play('restaurant-ordering', ['recommend', 'spicy']);
  expect([...host.querySelectorAll('.bubble-zh')].map(b => b.textContent)).toEqual(['请问您想点什么？', '你们有什么推荐？', '我们的招牌菜是红烧肉。', '辣不辣？', '不辣，有一点儿甜。']);
});

it('repairs stay on the same turn with the same replies', async () => {
  await play('restaurant-ordering');
  const before = [...host.querySelectorAll('.reply-option')].map(b => b.textContent);
  await help();
  await click(button(/Could you say it a different way\?/));
  expect(host.querySelector('.thread')?.textContent).toContain('您决定好要吃什么了吗？');
  expect(host.textContent).toContain('Still the same turn');
  await help();
  await click(button(/I'm not sure/));
  expect(host.querySelector('.thread')?.textContent).toContain('没关系，慢慢来。');
  expect([...host.querySelectorAll('.reply-option')].map(b => b.textContent)).toEqual(before);
  expect(window.location.hash).toBe('');
});

it('asking for English reveals the meaning when it is hidden', async () => {
  localStorage.setItem('dialogue:meaning', 'false');
  await play('directions-subway');
  expect(host.querySelector('.current .meaning')).toBeNull();
  await help();
  await click(button(/Could you say that in English\?/));
  expect(host.querySelector('.current .meaning')?.textContent).toBe('Where are you going?');
});

it('shows a clear fallback when no alternate wording exists', async () => {
  await play('restaurant-ordering', ['recommend', 'spicy']);
  await help();
  await click(button(/I don't understand/));
  expect(host.textContent).toContain('No other wording is prepared');
});

it('finder opens a phrase sheet with replies without advancing anything', async () => {
  await render(<Finder scenarioId="directions-subway" nodeId="where" />);
  const input = host.querySelector<HTMLInputElement>('#find-q')!;
  expect(host.querySelector('label[for="find-q"]')).not.toBeNull();
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, 'exit');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(host.querySelector('.list-row')!);
  expect(host.querySelector('[role="dialog"]')?.textContent).toContain('Replies you can use');
  expect(window.location.hash).toBe('');
});

it('replies become available when a repair interrupts the playing line', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined); // plays, never ends
  await play('restaurant-ordering');
  expect(host.querySelector('.reply-option:disabled')).not.toBeNull();
  await help();
  await click(button(/Could you repeat that\?/));
  expect(host.querySelector('.reply-option:disabled')).toBeNull();
});
