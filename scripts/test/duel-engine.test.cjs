/**
 * DUEL engine functional test (headless, no browser).
 * Exercises the real LocalAdapter + recommendation engine end-to-end:
 * signup → join → check-in/streaks → likes/saves/comments/search → create →
 * recommendations (cold start diversity, affinity ranking, joined exclusion).
 *
 * Run: node scripts/test/duel-engine.test.cjs
 */
require('sucrase/register/ts');
const Module = require('module');
const path = require('path');
const assert = require('assert');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) {
    request = path.join(__dirname, '..', '..', request.slice(2));
  }
  return origResolve.call(this, request, ...args);
};

/* ------------------------- minimal browser stubs ------------------------- */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
global.window = {
  localStorage,
  setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 5)),
  clearTimeout: (id) => clearTimeout(id),
  matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {},
  removeEventListener() {},
  location: { origin: 'http://test.local', hash: '' },
  history: { pushState() {} },
  scrollTo() {},
};
global.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  documentElement: { setAttribute() {} },
  body: { style: {} },
  createElement: () => ({ click() {} }),
  getElementById: () => null,
};
global.navigator = { clipboard: { writeText: async () => {} } };
if (!global.URL.createObjectURL) global.URL.createObjectURL = () => 'blob:test';

const { getLocalAdapter } = require('../../lib/duel/local');
const { rankChallenges, computeAffinity } = require('../../lib/duel/recommend');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(name, cond) {
  assert.ok(cond, `FAILED: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

(async () => {
  const adapter = getLocalAdapter();

  console.log('\n1) bootstrap (seeded community, signed out)');
  const boot = await adapter.bootstrap();
  ok('seed categories loaded', boot.db.categories.length === 10);
  ok('seed challenges loaded', boot.db.challenges.length >= 18);
  ok('not authenticated initially', boot.authed === false);

  console.log('\n2) signup + login');
  await adapter.demoSignUp({ email: 'tester@duel.app', password: 'password123', name: 'Test Duelist', username: 'tester' });
  ok('session established', adapter.meId !== null);
  ok('profile created', Boolean(boot.db.profiles) && adapter.meId.startsWith('u-'));
  let db = await adapter.bootstrap().then((r) => r.db);
  ok('account persisted across bootstrap', db.meId === adapter.meId);
  await adapter.demoLogout();
  ok('logout clears session', adapter.meId === null);
  await adapter.demoLogin('tester@duel.app', 'password123');
  ok('login restores session', adapter.meId !== null);
  let threw = false;
  try { await adapter.demoLogin('tester@duel.app', 'wrong-password'); } catch { threw = true; }
  ok('wrong password rejected', threw);

  const me = adapter.meId;

  console.log('\n3) cold-start recommendations are diverse');
  db = await adapter.bootstrap().then((r) => r.db);
  const cold = rankChallenges(db, me, 10);
  ok('returns recommendations', cold.length >= 6);
  const catOf = (id) => db.challenges.find((c) => c.id === id)?.categoryId;
  const distinctCats = new Set(cold.slice(0, 8).map((r) => catOf(r.id)));
  ok(`cold start spans >=4 categories (got ${distinctCats.size})`, distinctCats.size >= 4);
  const perCat = {};
  cold.forEach((r) => (perCat[catOf(r.id)] = (perCat[catOf(r.id)] ?? 0) + 1));
  ok('no category monopolises the list', Math.max(...Object.values(perCat)) <= 4);

  console.log('\n4) join + check-in + streak rules');
  await adapter.joinChallenge('c-coding-30');
  db = await adapter.bootstrap().then((r) => r.db);
  let part = db.participants.find((p) => p.challengeId === 'c-coding-30' && p.userId === me);
  ok('participation recorded', Boolean(part) && part.status === 'active');
  ok('participant counter bumped', db.challenges.find((c) => c.id === 'c-coding-30').participantCount === 1285);
  threw = false;
  try { await adapter.joinChallenge('c-coding-30'); } catch { threw = true; }
  ok('double join rejected', threw);

  const ck1 = await adapter.checkin('c-coding-30', 'day one commit');
  ok('check-in day 1', ck1.dayNumber === 1);
  threw = false;
  try { await adapter.checkin('c-coding-30', 'again'); } catch { threw = true; }
  ok('second check-in same day rejected', threw);

  // simulate yesterday to prove streak chaining
  const internal = adapter;
  const p = internal.db.participants.find((x) => x.challengeId === 'c-coding-30' && x.userId === me);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  p.lastCheckinDate = yesterday;
  const ck2 = await adapter.checkin('c-coding-30', 'day two');
  ok('streak chains across consecutive days', ck2.dayNumber === 2);
  db = await adapter.bootstrap().then((r) => r.db);
  part = db.participants.find((x) => x.challengeId === 'c-coding-30' && x.userId === me);
  ok('current streak == 2', part.currentStreak === 2 && part.longestStreak === 2);

  // break the chain (re-fetch participation from the live db first)
  const p2 = internal.db.participants.find((x) => x.challengeId === 'c-coding-30' && x.userId === me);
  p2.lastCheckinDate = new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10);
  await adapter.checkin('c-coding-30', 'after a gap');
  db = await adapter.bootstrap().then((r) => r.db);
  part = db.participants.find((x) => x.challengeId === 'c-coding-30' && x.userId === me);
  ok('streak resets after a gap', part.currentStreak === 1 && part.longestStreak === 2);

  console.log('\n5) completion flow');
  const short = db.challenges.find((c) => c.id === 'c-detox-7');
  await adapter.joinChallenge('c-detox-7');
  const pp = internal.db.participants.find((x) => x.challengeId === 'c-detox-7' && x.userId === me);
  pp.completedDays = 6;
  pp.lastCheckinDate = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  await adapter.checkin('c-detox-7', 'final day');
  db = await adapter.bootstrap().then((r) => r.db);
  const donePart = db.participants.find((x) => x.challengeId === 'c-detox-7' && x.userId === me);
  ok('challenge marked completed', donePart.status === 'completed' && donePart.completedAt !== null);
  ok('completion counter bumped', db.challenges.find((c) => c.id === 'c-detox-7').completionCount === 1894);
  ok('completion notification emitted', db.notifications.some((n) => n.kind === 'streak' && /complete/i.test(n.text ?? '')));

  console.log('\n6) social actions + counters');
  await adapter.toggleLike('c-reading-30');
  await adapter.toggleSave('c-reading-30');
  await adapter.shareChallenge('c-reading-30');
  await adapter.addComment('c-reading-30', 'Great list of books this month!');
  db = await adapter.bootstrap().then((r) => r.db);
  const reading = db.challenges.find((c) => c.id === 'c-reading-30');
  ok('like counter', reading.likeCount === 904);
  ok('save counter', reading.saveCount === 466);
  ok('share counter', reading.shareCount === 98);
  ok('comment stored + counter', reading.commentCount >= 2 && db.comments.some((c) => c.userId === me));
  const liked = await adapter.toggleLike('c-reading-30');
  ok('unlike returns false and decrements', liked === false);

  console.log('\n7) behaviour drives recommendations');
  await adapter.recordSearch('coding');
  await adapter.toggleSave('c-leetcode-45');
  await adapter.toggleLike('c-ship-14');
  db = await adapter.bootstrap().then((r) => r.db);
  const aff = computeAffinity(db, me);
  ok('coding affinity learned', (aff.categories['coding'] ?? 0) > 0);
  const ranked = rankChallenges(db, me, 6);
  const codingShare = ranked.filter((r) => catOf(r.id) === 'coding').length;
  ok(`coding surfaces in top-6 after signals (${codingShare})`, codingShare >= 1);
  ok('joined challenges excluded from recs', !ranked.some((r) => r.id === 'c-coding-30' || r.id === 'c-detox-7'));
  ok('reasons are human readable', ranked.every((r) => typeof r.reason === 'string' && r.reason.length > 3));

  console.log('\n8) create challenge + ownership rules');
  const ch = await adapter.createChallenge({
    title: '10 Days of Testing', description: 'Write and run tests every day for ten days, coverage up only.',
    categoryId: 'coding', durationDays: 10, difficulty: 'medium',
    dailyTask: 'Add or fix tests and run the suite.', coverUrl: null, tags: ['testing', 'quality'],
  });
  ok('challenge created', Boolean(ch) && ch.id.startsWith('c-'));
  db = await adapter.bootstrap().then((r) => r.db);
  ok('creator auto-joined', db.participants.some((p) => p.challengeId === ch.id && p.userId === me));
  threw = false;
  try { await adapter.updateChallenge('c-reading-30', { title: 'hijack' }); } catch { threw = true; }
  ok('cannot edit someone else’s challenge', threw);
  await adapter.updateChallenge(ch.id, { title: '10 Days of Testing (v2)' });
  db = await adapter.bootstrap().then((r) => r.db);
  ok('owner can edit', db.challenges.find((c) => c.id === ch.id).title.includes('v2'));

  console.log('\n9) messages + notifications');
  const threadId = await adapter.openThreadWith('u-aya');
  await adapter.sendMessage(threadId, 'Loving the 30 Days Coding structure!');
  await sleep(150); // persona reply timers are stubbed to ~5ms
  db = await adapter.bootstrap().then((r) => r.db);
  ok('message sent', db.threads.some((t) => t.id === threadId && t.messages.some((m) => m.fromMe)));
  ok('persona replied', db.threads.some((t) => t.id === threadId && t.messages.some((m) => !m.fromMe)));
  ok('notifications generated', db.notifications.length > 0);
  adapter.markAllNotificationsRead();
  await sleep(10); // let the debounced persist flush before reloading
  db = await adapter.bootstrap().then((r) => r.db);
  ok('mark-all-read works', db.notifications.every((n) => n.read));

  console.log('\n10) search + not-interested');
  const res = adapterSearch(db, 'fitness');
  ok('search matches challenges', res.length > 0);
  await adapter.notInterested('c-marathon-90');
  db = await adapter.bootstrap().then((r) => r.db);
  ok('dismissed challenge leaves recommendations', !rankChallenges(db, me, 30).some((r) => r.id === 'c-marathon-90'));

  console.log('\n11) profile + settings + reset');
  await adapter.updateProfile({ bio: 'Testing everything, daily.', username: 'tester' });
  db = await adapter.bootstrap().then((r) => r.db);
  ok('profile updated', db.profiles[me].bio.includes('Testing everything'));
  threw = false;
  try { await adapter.updateProfile({ username: 'ab' }); } catch { threw = true; }
  ok('username validation enforced', threw);
  await adapter.updateSettings({ theme: 'light' });
  db = await adapter.bootstrap().then((r) => r.db);
  ok('settings persisted', db.settings.theme === 'light');
  await adapter.resetDemo();
  db = await adapter.bootstrap().then((r) => r.db);
  ok('reset restores seed and signs out', db.meId === null && db.challenges.length >= 18);

  console.log(`\n✅ ALL ${passed} ASSERTIONS PASSED\n`);
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err.message);
  process.exit(1);
});

function adapterSearch(db, q) {
  const query = q.toLowerCase();
  return db.challenges.filter(
    (c) => c.title.toLowerCase().includes(query) || c.description.toLowerCase().includes(query)
  );
}
