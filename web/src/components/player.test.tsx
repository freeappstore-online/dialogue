// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scenarioById } from '../dialogue/catalog';
import { walk } from '../dialogue/model';
import { DialoguePlayer } from './DialoguePlayer';
import { DisplayProvider } from './prefs';
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

const render = async (el: React.ReactElement) => { await act(async () => root.render(<DisplayProvider>{el}</DisplayProvider>)); };
const button = (text: string | RegExp) => [...host.querySelectorAll('button')].find(b => (typeof text === 'string' ? b.textContent?.includes(text) : text.test(b.textContent ?? '')))!;
const click = async (el: Element) => { await act(async () => (el as HTMLElement).click()); };

const play = async (id: string, path: string[] = []) => {
  const s = scenarioById(id)!;
  await render(<DialoguePlayer scenario={s} path={path} nodeId={walk(s, path).nodeId} />);
};
const help = async () => click(button(/^Help$/));
/** Visible characters, without the pinyin shown above them. */
const zhText = (el: Element | null) => { const c = el!.cloneNode(true) as Element; c.querySelectorAll('rt, .pinyin-line').forEach(r => r.remove()); return c.textContent ?? ''; };
const setDisplay = (d: object) => localStorage.setItem('dialogue:display', JSON.stringify(d));

it('plays a turn manually with no microphone and no audio', async () => {
  await play('restaurant-ordering');
  expect(zhText(host.querySelector('.bubble-row.current'))).toContain('请问您想点什么？');
  await click(button('What do you recommend?'));
  expect(host.querySelector('[aria-label="Check my reply (optional)"]')).toBeNull();
  await click(button('Show me how to say it'));
  expect(zhText(host.querySelector('.composer'))).toContain('你们有什么推荐？');
  await click(button('Send'));
  expect(window.location.hash).toBe('#/play/restaurant-ordering/recommend');
});

it('rebuilds the whole thread from the path', async () => {
  await play('restaurant-ordering', ['recommend', 'spicy']);
  expect([...host.querySelectorAll('.bubble-zh')].map(zhText)).toEqual(['请问您想点什么？', '你们有什么推荐？', '我们的招牌菜是红烧肉。', '辣不辣？', '不辣，有一点儿甜。']);
});

it('repairs stay on the same turn with the same replies', async () => {
  await play('restaurant-ordering');
  const before = [...host.querySelectorAll('.reply-option')].map(b => b.textContent);
  await help();
  await click(button(/Could you say it a different way\?/));
  expect(zhText(host.querySelector('.thread'))).toContain('您决定好要吃什么了吗？');
  expect(host.textContent).toContain('Still the same turn');
  await help();
  await click(button(/I'm not sure/));
  expect(zhText(host.querySelector('.thread'))).toContain('没关系，慢慢来。');
  expect([...host.querySelectorAll('.reply-option')].map(b => b.textContent)).toEqual(before);
  expect(window.location.hash).toBe('');
});

it('asking for English reveals the meaning when it is hidden', async () => {
  setDisplay({ meaning: false });
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

it('replies can be chosen while the line plays, which stops it, and focus follows', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined); // plays, never ends
  const pause = vi.mocked(HTMLMediaElement.prototype.pause);
  await play('restaurant-ordering');
  expect(host.querySelector('.reply-option:disabled')).toBeNull();
  expect(button('Stop audio')).toBeDefined();
  pause.mockClear();
  await click(button('What do you recommend?'));
  expect(pause).toHaveBeenCalled();
  expect(document.activeElement?.textContent).toBe('Your reply');
  expect(host.textContent).toContain('in Mandarin, out loud');
  await click(button('Change'));
  expect(document.activeElement?.textContent).toBe('Your turn');
});

it('a repair during playback leaves every reply available', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  await play('restaurant-ordering');
  await help();
  await click(button(/Could you repeat that\?/));
  expect(host.querySelector('.reply-option:disabled')).toBeNull();
  expect(host.querySelectorAll('.reply-option')).toHaveLength(4);
});

it('the phrase finder returns to the exact thread', async () => {
  await play('restaurant-ordering', ['rice', 'else']);
  await help();
  const link = [...host.querySelectorAll('a')].find(a => a.textContent?.includes('Heard something else'))!;
  expect(link.getAttribute('href')).toBe('#/find/restaurant-ordering/rice/else');
  act(() => root.unmount());
  root = createRoot(host);
  await render(<Finder scenarioId="restaurant-ordering" path={['rice', 'else']} nodeId="recommend" />);
  expect(host.querySelector('.context-chip')?.getAttribute('href')).toBe('#/play/restaurant-ordering/rice/else');
});

it('sent replies can be played too, and pinyin sits above each character', async () => {
  await play('restaurant-ordering', ['recommend']);
  const mine = host.querySelector('.bubble-row.you')!;
  expect(mine.querySelector('[aria-label="Play my reply: What do you recommend?"]')).not.toBeNull();
  const ruby = [...mine.querySelectorAll('ruby:not(.punct)')].map(r => [r.firstChild?.textContent, r.querySelector('rt')?.textContent]);
  expect(ruby.slice(0, 3)).toEqual([['你', 'nǐ'], ['们', 'men'], ['有', 'yǒu']]);
  const spy = vi.mocked(HTMLMediaElement.prototype.play);
  spy.mockClear();
  await click(mine.querySelector('[aria-label^="Play my reply"]')!);
  expect(spy).toHaveBeenCalled();
});

it('every display option is respected', async () => {
  setDisplay({ pinyin: 'below', playThem: false, playYou: false, size: 'xl', bold: true });
  await play('restaurant-ordering', ['recommend']);
  expect(host.querySelector('ruby')).toBeNull();
  expect(host.querySelector('.bubble-row.you .pinyin-line')?.textContent).toBe('Nǐmen yǒu shénme tuījiàn?');
  expect(host.querySelector('.bubble [aria-label^="Play"]')).toBeNull();
  expect(document.documentElement.dataset.zhSize).toBe('xl');
  expect(document.documentElement.dataset.zhWeight).toBe('bold');
});

it('auto-play off leaves the replies ready without playing', async () => {
  setDisplay({ autoplay: false });
  const spy = vi.mocked(HTMLMediaElement.prototype.play);
  spy.mockClear();
  await play('restaurant-ordering');
  expect(spy).not.toHaveBeenCalled();
  expect(host.querySelector('.reply-option:disabled')).toBeNull();
});

it('changing a setting in the sheet updates the conversation live', async () => {
  await play('restaurant-ordering');
  expect(host.querySelector('.bubble-row.current ruby')).not.toBeNull();
  await click(host.querySelector('[aria-label="Conversation menu"]')!);
  await click(host.querySelector('button[aria-pressed][aria-label="No pinyin"]')!);
  expect(host.querySelector('.bubble-row.current ruby')).toBeNull();
  expect(JSON.parse(localStorage.getItem('dialogue:display')!).pinyin).toBe('off');
});
