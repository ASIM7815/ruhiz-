/**
 * DUEL timeline UI test (headless DOM, no browser).
 *
 * Renders the real ChallengeDetailView from the real store in preview mode
 * (localStorage adapter) after creating a challenge and logging two days of
 * proof, then asserts the day-by-day timeline shows every entry and that its
 * actions (edit entry, like) reach the shared data layer.
 *
 * Run: node scripts/test/timeline-ui.test.cjs      (needs jsdom installed)
 */
const Module = require('module');
const fs = require('fs');
const { transform } = require('sucrase');

/* Compile TS/TSX with the automatic JSX runtime (same as Next.js). */
const compile = (module_, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { code } = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    filePath: filename,
    production: true,
  });
  module_._compile(code, filename);
};
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = compile;
const path = require('path');
const assert = require('assert');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) request = path.join(__dirname, '..', '..', request.slice(2));
  return origResolve.call(this, request, ...args);
};

/* ------------------------------ DOM harness ------------------------------ */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000/feed#/challenge/test',
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.Event = dom.window.Event;
global.MouseEvent = dom.window.MouseEvent;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.IS_REACT_ACT_ENVIRONMENT = true;
if (!dom.window.matchMedia) {
  dom.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
}
if (!global.URL.createObjectURL) global.URL.createObjectURL = () => 'blob:test';
global.scrollTo = () => {};
if (!dom.window.HTMLElement.prototype.scrollIntoView) dom.window.HTMLElement.prototype.scrollIntoView = () => {};

const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react');

const { StoreProvider } = require('../../lib/duel/store');
const { NavContext } = require('../../components/app/nav');
const { getLocalAdapter } = require('../../lib/duel/local');
const ChallengeDetailView = require('../../components/views/ChallengeDetailView').default;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (name, cond) => {
  assert.ok(cond, `FAILED: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
};
const text = () => document.body.textContent || '';
const buttons = () => Array.from(document.querySelectorAll('button'));
const clickText = async (needle, occurrence = 1) => {
  let seen = 0;
  for (const el of buttons()) {
    const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (label.includes(needle)) {
      seen++;
      if (seen === occurrence) {
        await act(async () => {
          el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
        });
        await sleep(30);
        return true;
      }
    }
  }
  return false;
};
const waitFor = async (predicate, timeout = 5000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    await act(async () => {
      await sleep(25);
    });
  }
  return predicate();
};

(async () => {
  /* -------- seed real data through the same adapter the app uses -------- */
  const adapter = getLocalAdapter();
  await adapter.demoSignUp({
    email: 'alex@duel.test',
    password: 'password123',
    name: 'Alex Runner',
    username: 'alex_runner',
  });
  const challenge = await adapter.createChallenge({
    title: '30 Days Coding Grind',
    description: 'Ship real code every day for thirty days.',
    categoryId: 'coding',
    durationDays: 30,
    difficulty: 'hard',
    dailyTask: 'Commit code or solve one problem.',
    coverUrl: null,
    tags: ['coding'],
  });
  await adapter.checkin(challenge.id, 'Day 1 done: built the challenge timeline.', 'proofs/local/day1.png', 'image', 1);
  await adapter.checkin(challenge.id, 'Day 2 written entry: no media, shipped tests.', null, null, 2);

  /* ------------------------------- render ------------------------------- */
  console.log('\n1) challenge timeline renders real entries');
  const container = document.getElementById('root');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(
        NavContext.Provider,
        { value: { route: { view: 'challenge', param: challenge.id }, navigate: () => {} } },
        React.createElement(StoreProvider, null, React.createElement(ChallengeDetailView, { challengeId: challenge.id }))
      )
    );
  });
  ok('view hydrated with the challenge', await waitFor(() => text().includes('30 Days Coding Grind'), 8000));
  ok('day-by-day timeline section rendered', await waitFor(() => text().includes('Day-by-Day Timeline'), 8000));
  ok('timeline summary counts entries and challengers', /\d+ entr(y|ies) from \d+ challenger/.test(text()));
  ok('day 1 entry shows its caption', text().includes('built the challenge timeline'));
  ok('caption-only day 2 entry is on the timeline', text().includes('no media, shipped tests'));
  ok('entry cards are labelled by day', /Day 1/.test(text()) && /Day 2/.test(text()));
  ok('own entries carry the edit affordance', buttons().some((b) => /Edit entry/.test(b.textContent || '')));

  console.log('\n2) timeline interactions reach the shared data layer');
  const likeButtonBefore = document.querySelector('button[aria-label^="Like "]');
  ok('like button present on an entry', Boolean(likeButtonBefore));
  await act(async () => {
    likeButtonBefore.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    await sleep(50);
  });
  // the like is persisted to the shared snapshot (duel.db.v2) on a microtask
  let persisted = null;
  for (let i = 0; i < 40 && !(persisted && persisted.postLikes.length === 1); i++) {
    await act(async () => {
      await sleep(50);
    });
    persisted = JSON.parse(dom.window.localStorage.getItem('duel.db.v2') || 'null');
  }
  ok('like persisted in the shared snapshot', Boolean(persisted) && persisted.postLikes.length === 1);
  ok('like count rendered on the entry', /^1$/.test((document.querySelector('button[aria-label^="Unlike "]')?.textContent || '').trim()));

  const timelineAfterLike = await adapter.loadChallengePosts(challenge.id);
  ok('timeline reports the like', timelineAfterLike.some((p) => p.likeCount === 1 && p.iLiked));
  ok('timeline like came from the viewer', persisted.postLikes[0].userId === persisted.meId);

  ok('edit entry opens the check-in modal', await clickText('Edit entry'));
  ok('modal is pre-filled for that day', await waitFor(() => text().includes('Edit Day 1 Proof'), 4000));
  ok('modal exposes the proof note for editing', await waitFor(() => {
    const area = document.querySelector('#checkin-note');
    return Boolean(area) && area.value.includes('built the challenge timeline');
  }, 4000));

  await act(async () => {
    root.unmount();
  });
  console.log(`\n✅ ALL ${passed} TIMELINE UI ASSERTIONS PASSED\n`);
  process.exit(0);
})().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
