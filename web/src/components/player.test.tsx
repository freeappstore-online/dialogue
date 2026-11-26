// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scenarioById } from '../dialogue/catalog';
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

it('plays a turn manually with no microphone and no audio', async () => {
  const s = scenarioById('restaurant-ordering')!;
  await render(<DialoguePlayer scenario={s} nodeId="order" />);
  expect(host.textContent).toContain('请问您想点什么？');
  await click(button('What do you recommend?'));
  expect(host.textContent).toContain('Speech matching isn’t available');
  await click(button('Reveal Mandarin reply hint'));
  expect(host.textContent).toContain('你们有什么推荐？');
  await click(button('Continue'));
  expect(window.location.hash).toBe('#/play/restaurant-ordering/recommend');
});

it('repairs return to the same turn with the same replies', async () => {
  const s = scenarioById('restaurant-ordering')!;
  await render(<DialoguePlayer scenario={s} nodeId="order" />);
  const before = [...host.querySelectorAll('.choice')].map(b => b.textContent);
  await click(host.querySelector('.help summary')!);
  await click(button(/Could you say it a different way\?/));
  expect(host.textContent).toContain('您决定好要吃什么了吗？');
  expect(host.textContent).toContain('Still the same turn');
  await click(button(/I'm not sure/));
  expect(host.textContent).toContain('没关系，慢慢来。');
  expect([...host.querySelectorAll('.choice')].map(b => b.textContent)).toEqual(before);
  expect(window.location.hash).toBe('');
});

it('asking for English reveals the meaning when it is hidden', async () => {
  localStorage.setItem('dialogue:meaning', 'false');
  await render(<DialoguePlayer scenario={scenarioById('directions-subway')!} nodeId="where" />);
  expect(host.querySelector('.card .translation')).toBeNull();
  await click(button(/Could you say that in English\?/));
  expect(host.querySelector('.card .translation')?.textContent).toBe('Where are you going?');
});

it('shows a clear fallback when no alternate wording exists', async () => {
  await render(<DialoguePlayer scenario={scenarioById('restaurant-ordering')!} nodeId="pork-spicy" />);
  await click(button(/I don't understand/));
  expect(host.textContent).toContain('No other wording is prepared');
});

it('finder lets you tap a phrase to see replies without advancing anything', async () => {
  await render(<Finder scenarioId="directions-subway" nodeId="where" />);
  const input = host.querySelector<HTMLInputElement>('#find-q')!;
  expect(host.querySelector('label[for="find-q"]')).not.toBeNull();
  await act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, 'exit');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const first = host.querySelector<HTMLButtonElement>('.entry-head')!;
  await click(first);
  expect(first.getAttribute('aria-expanded')).toBe('true');
  expect(host.textContent).toContain('Replies you can use');
  expect(window.location.hash).toBe('');
});
