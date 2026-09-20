/**
 * DUEL engine functional test (headless, no browser).
 * Exercises the clean LocalAdapter + performance engine + media proof flow:
 * signup → create challenge → upload proof (photos/videos) → performance scoring →
 * timeline tracking → explore feeds → social actions.
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
const { calculatePerformance } = require('../../lib/duel/performance');
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

  console.log('\n1) bootstrap (clean database, no fake content, signed out)');
  const boot = await adapter.bootstrap();
  ok('categories loaded (10 standard categories)', boot.db.categories.length === 10);
  ok('no fake starter challenges in DB', boot.db.challenges.length === 0);
  ok('no fake profiles in DB', Object.keys(boot.db.profiles).length === 0);
  ok('not authenticated initially', boot.authed === false);

  console.log('\n2) real user signup + login');
  await adapter.demoSignUp({ email: 'alex@duel.app', password: 'password123', name: 'Alex Runner', username: 'alex_runner' });
  ok('session established', adapter.meId !== null);
  ok('real profile created', adapter.meId.startsWith('u-'));
  let db = await adapter.bootstrap().then((r) => r.db);
  ok('account persisted across bootstrap', db.meId === adapter.meId);
  ok('profile display name matches', db.profiles[adapter.meId].name === 'Alex Runner');
  await adapter.demoLogout();
  ok('logout clears session', adapter.meId === null);
  await adapter.demoLogin('alex@duel.app', 'password123');
  ok('login restores session', adapter.meId !== null);
  let threw = false;
  try { await adapter.demoLogin('alex@duel.app', 'wrong-password'); } catch { threw = true; }
  ok('wrong password rejected', threw);

  const me = adapter.meId;

  console.log('\n3) create real challenge & verify auto-join');
  const ch = await adapter.createChallenge({
    title: '30 Days Coding Grind',
    description: 'Commit code and solve algorithms every single day for thirty days.',
    categoryId: 'coding',
    durationDays: 30,
    difficulty: 'hard',
    dailyTask: 'Commit at least one verified pull request or solve 1 DSA problem.',
    coverUrl: null,
    tags: ['coding', 'consistency'],
  });
  ok('challenge created', Boolean(ch) && ch.id.startsWith('c-'));
  ok('participant count starts at 1 for creator', ch.participantCount === 1);
  ok('like count starts at 0 (no fake likes)', ch.likeCount === 0);
  db = await adapter.bootstrap().then((r) => r.db);
  let part = db.participants.find((p) => p.challengeId === ch.id && p.userId === me);
  ok('creator auto-joined with active status', Boolean(part) && part.status === 'active');
  ok('completed days starts at 0', part.completedDays === 0);

  console.log('\n4) daily proof check-in with video/photo proof & description');
  // Day 1: checkin with photo proof
  const ck1 = await adapter.checkin(
    ch.id,
    'Day 1 done: Built the challenge timeline proof cards and committed code.',
    'proofs/local/day1-screenshot.jpg',
    'image',
    1
  );
  ok('check-in day 1 recorded', ck1.dayNumber === 1);
  ok('photo proof media URL stored', ck1.mediaUrl === 'proofs/local/day1-screenshot.jpg');
  ok('media type is image', ck1.mediaType === 'image');
  ok('note/description saved', ck1.note.includes('timeline proof cards'));

  db = await adapter.bootstrap().then((r) => r.db);
  part = db.participants.find((p) => p.challengeId === ch.id && p.userId === me);
  ok('current streak is 1', part.currentStreak === 1);
  ok('completed days incremented to 1', part.completedDays === 1);

  // Updating existing day 1 proof (replacing photo with video proof)
  const ck1Update = await adapter.checkin(
    ch.id,
    'Updated Day 1: Added video recording proof of tests running.',
    'proofs/local/day1-screenrecording.mp4',
    'video',
    1
  );
  ok('same day proof updated', ck1Update.mediaType === 'video' && ck1Update.note.includes('video recording'));
  db = await adapter.bootstrap().then((r) => r.db);
  ok('completed days still 1 after update', db.participants.find((p) => p.challengeId === ch.id && p.userId === me).completedDays === 1);

  // Day 2: simulate consecutive day check-in with video proof
  const internal = adapter;
  const p = internal.db.participants.find((x) => x.challengeId === ch.id && x.userId === me);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  p.lastCheckinDate = yesterday;

  const ck2 = await adapter.checkin(
    ch.id,
    'Day 2 complete: Solved 2 LeetCode medium problems in Go.',
    'proofs/local/day2-proof.mp4',
    'video',
    2
  );
  ok('day 2 check-in recorded', ck2.dayNumber === 2);
  ok('video proof stored', ck2.mediaUrl === 'proofs/local/day2-proof.mp4' && ck2.mediaType === 'video');
  db = await adapter.bootstrap().then((r) => r.db);
  part = db.participants.find((p) => p.challengeId === ch.id && p.userId === me);
  ok('streak chained to 2', part.currentStreak === 2);
  ok('completed days is 2', part.completedDays === 2);

  console.log('\n5) dynamic performance score calculation (no hardcoded values)');
  const challengeCheckins = db.checkins.filter((c) => c.challengeId === ch.id && c.userId === me);
  const perf = calculatePerformance(ch, part, challengeCheckins);
  ok('performance report generated', typeof perf.score === 'number');
  ok('score is between 0 and 100', perf.score >= 0 && perf.score <= 100);
  ok('grade calculated dynamically', ['S', 'A', 'B', 'C', 'D'].includes(perf.grade));
  ok('completed days matches checkins (2)', perf.completedDays === 2);
  ok('total videos proof counted (2)', perf.totalVideos === 2);
  ok('proof rate calculated (100%)', perf.proofRate === 100);
  ok('timeline items created for all 30 days', perf.timeline.length === 30);
  ok('day 1 status is completed', perf.timeline[0].status === 'completed');
  ok('day 2 status is completed', perf.timeline[1].status === 'completed');
  ok('summary message generated', perf.summary.length > 10);

  console.log('\n6) real second user joins & social counters');
  await adapter.demoSignUp({ email: 'bob@duel.app', password: 'password123', name: 'Bob Builder', username: 'bob_builds' });
  const bobId = adapter.meId;
  ok('second user signed up', bobId !== me);

  await adapter.joinChallenge(ch.id);
  await adapter.toggleLike(ch.id);
  await adapter.toggleSave(ch.id);
  await adapter.addComment(ch.id, 'Joined this challenge! Excited to post daily video proofs.');

  db = await adapter.bootstrap().then((r) => r.db);
  const updatedCh = db.challenges.find((c) => c.id === ch.id);
  ok('participant count accurately bumped to 2', updatedCh.participantCount === 2);
  ok('like count accurately bumped to 1', updatedCh.likeCount === 1);
  ok('save count accurately bumped to 1', updatedCh.saveCount === 1);
  ok('comment count accurately bumped to 1', updatedCh.commentCount === 1);

  // Bob check-in with photo proof
  const bobCk = await adapter.checkin(
    ch.id,
    'Day 1 from Bob: Setup Next.js repo with TypeScript.',
    'proofs/local/bob-day1.png',
    'image',
    1
  );
  ok('second user uploaded photo proof', bobCk.mediaType === 'image');

  console.log('\n7) media feed aggregation (Videos & Photos)');
  db = await adapter.bootstrap().then((r) => r.db);
  const allVideoProofs = db.checkins.filter((c) => c.mediaType === 'video' && Boolean(c.mediaUrl));
  const allPhotoProofs = db.checkins.filter((c) => c.mediaType === 'image' && Boolean(c.mediaUrl));
  ok('video proofs query returns real videos', allVideoProofs.length >= 2);
  ok('photo proofs query returns real photos', allPhotoProofs.length >= 1);
  ok('no fake posts in database', db.checkins.every((c) => c.userId === me || c.userId === bobId));

  console.log('\n8) ownership & permission validation');
  threw = false;
  try {
    await adapter.updateChallenge(ch.id, { title: 'Bob hijacked this' });
  } catch {
    threw = true;
  }
  ok('non-owner cannot edit someone else’s challenge', threw);

  // Switch back to creator
  await adapter.demoLogin('alex@duel.app', 'password123');
  await adapter.updateChallenge(ch.id, { title: '30 Days Coding Grind (Updated)' });
  db = await adapter.bootstrap().then((r) => r.db);
  ok('owner can edit challenge', db.challenges.find((c) => c.id === ch.id).title.includes('(Updated)'));

  console.log('\n9) reset demo preserves clean slate');
  await adapter.resetDemo();
  db = await adapter.bootstrap().then((r) => r.db);
  ok('reset clears all challenges and profiles', db.challenges.length === 0 && Object.keys(db.profiles).length === 0);
  ok('categories remain intact (10)', db.categories.length === 10);

  console.log(`\n✅ ALL ${passed} ASSERTIONS PASSED\n`);
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
