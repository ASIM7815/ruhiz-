/**
 * DUEL engine unit tests (headless, no browser, no network).
 *
 * These exercise the *pure* decision logic that the production UI is built on:
 *   1. Row → domain mappers + IdMapper  (the DB → app contract)
 *   2. Performance engine                (score, grade, day timeline)
 *   3. Recommendation engine             (affinity, ranking, diversity, trending)
 *
 * There is no local/demo adapter and no fake dataset: every assertion works
 * from in-memory fixtures shaped exactly like the Supabase rows the mappers
 * consume, so the logic is verified independently of the live backend.
 *
 * Run: npm test   (or: node scripts/test/duel-engine.test.cjs)
 */
require('sucrase/register/ts');
const Module = require('module');
const path = require('path');
const assert = require('assert');

// Resolve the Next.js `@/` alias to the repo root.
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith('@/')) {
    request = path.join(__dirname, '..', '..', request.slice(2));
  }
  return origResolve.call(this, request, ...args);
};

const {
  IdMapper,
  ME_APP_ID,
  mapChallenge,
  mapPost,
  mapParticipation,
  mapMessage,
  mapMessageRequest,
  mapPostComment,
} = require('../../lib/backend/api');
const { calculatePerformance } = require('../../lib/duel/performance');
const { computeAffinity, rankChallenges, trendingCategories } = require('../../lib/duel/recommend');
const { emptyDB } = require('../../lib/duel/db');

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, `FAILED: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}
function eq(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `FAILED: ${name} — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

/* ------------------------------------------------------------------ */
/* Fixture helpers                                                     */
/* ------------------------------------------------------------------ */
const ME_PROFILE = 'pf-me';
const ALICE_PROFILE = 'pf-alice';

const challengeRow = (over = {}) => ({
  id: 'c1',
  creator_id: ALICE_PROFILE,
  title: '30 Days Coding Grind',
  description: 'Ship something every day.',
  category_id: 'coding',
  duration_days: 30,
  difficulty: 'hard',
  daily_task: 'Commit at least one verified PR.',
  cover_url: null,
  tags: ['coding'],
  status: 'open',
  participant_count: 1,
  like_count: 0,
  comment_count: 0,
  save_count: 0,
  share_count: 0,
  view_count: 0,
  completion_count: 0,
  created_at: new Date().toISOString(),
  ...over,
});

const postRow = (over = {}) => ({
  id: 'p1',
  challenge_id: 'c1',
  user_id: ME_PROFILE,
  day_number: 1,
  checkin_date: new Date().toISOString().slice(0, 10),
  note: 'Day 1 done.',
  media_url: 'proofs/day1.png',
  media_type: 'image',
  like_count: 0,
  comment_count: 0,
  save_count: 0,
  share_count: 0,
  created_at: new Date().toISOString(),
  ...over,
});

function makeChallenge(over = {}) {
  return {
    id: 'c',
    creatorId: 'u2',
    title: 'Challenge',
    description: 'desc',
    categoryId: 'coding',
    durationDays: 30,
    difficulty: 'medium',
    dailyTask: 'task',
    coverUrl: null,
    tags: [],
    status: 'open',
    participantCount: 1,
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    shareCount: 0,
    viewCount: 0,
    completionCount: 0,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function makePost(over = {}) {
  return {
    id: 'p',
    challengeId: 'c',
    userId: 'me',
    dayNumber: 1,
    date: new Date().toISOString().slice(0, 10),
    note: 'note',
    mediaUrl: null,
    mediaType: null,
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    shareCount: 0,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

function makeParticipation(over = {}) {
  return {
    challengeId: 'c',
    userId: 'me',
    status: 'active',
    joinedAt: new Date().toISOString(),
    currentStreak: 0,
    longestStreak: 0,
    completedDays: 0,
    lastCheckinDate: null,
    completedAt: null,
    ...over,
  };
}

/* ================================================================== */
console.log('\n1) Row → domain mappers + IdMapper (DB contract)');
/* ================================================================== */
{
  const ids = new IdMapper(ME_PROFILE);

  eq('IdMapper maps own profile → "me"', ids.app(ME_PROFILE), ME_APP_ID);
  eq('IdMapper maps "me" → own profile', ids.profile(ME_APP_ID), ME_PROFILE);
  eq('IdMapper passes through unknown profile ids', ids.app(ALICE_PROFILE), ALICE_PROFILE);
  eq('IdMapper passes through unknown app ids', ids.profile('u-9'), 'u-9');

  const ch = mapChallenge(challengeRow());
  eq('mapChallenge maps snake_case counters', ch.participantCount, 1);
  eq('mapChallenge defaults difficulty', mapChallenge(challengeRow({ difficulty: null })).difficulty, 'medium');
  eq('mapChallenge carries creator id', ch.creatorId, ALICE_PROFILE);

  const post = mapPost(postRow(), ids);
  eq('mapPost maps author to "me"', post.userId, ME_APP_ID);
  eq('mapPost maps day_number → dayNumber', post.dayNumber, 1);
  eq('mapPost maps checkin_date → date', post.date, new Date().toISOString().slice(0, 10));
  eq('mapPost carries DB counters', post.likeCount, 0);
  eq('mapPost media type', post.mediaType, 'image');

  const part = mapParticipation(
    {
      challenge_id: 'c1',
      user_id: ME_PROFILE,
      status: 'active',
      joined_at: new Date().toISOString(),
      current_streak: 4,
      longest_streak: 6,
      completed_days: 9,
      last_checkin_date: '2026-01-05',
      completed_at: null,
    },
    ids
  );
  eq('mapParticipation maps streaks', part.currentStreak, 4);
  eq('mapParticipation maps completed days', part.completedDays, 9);

  eq(
    'mapMessage flags own sends (fromMe)',
    mapMessage({ id: 'm1', sender_id: ME_PROFILE, content: 'hi', media_url: null, media_type: null, created_at: new Date().toISOString() }, ME_PROFILE).fromMe,
    true
  );
  eq(
    'mapMessage flags others’ sends (fromMe=false)',
    mapMessage({ id: 'm2', sender_id: ALICE_PROFILE, content: 'yo', media_url: null, media_type: null, created_at: new Date().toISOString() }, ME_PROFILE).fromMe,
    false
  );

  eq(
    'mapMessageRequest maps endpoints + default status',
    mapMessageRequest({ id: 'r1', from_user: ALICE_PROFILE, to_user: ME_PROFILE, status: null, created_at: new Date().toISOString() }, ids),
    { id: 'r1', fromId: ALICE_PROFILE, toId: ME_APP_ID, status: 'pending', createdAt: new Date().toISOString() }
  );

  eq(
    'mapPostComment maps body → text',
    mapPostComment({ id: 'pc1', post_id: 'p1', user_id: ALICE_PROFILE, body: 'nice work', created_at: new Date().toISOString() }, ids).text,
    'nice work'
  );
}

/* ================================================================== */
console.log('\n2) Performance engine (score, grade, timeline)');
/* ================================================================== */
{
  const ch = makeChallenge({ durationDays: 30 });

  // Fresh duel: no participation, no check-ins → clean slate.
  const fresh = calculatePerformance(ch, null, []);
  eq('fresh duel scores 100 (clean slate)', fresh.score, 100);
  eq('fresh duel grade is S', fresh.grade, 'S');
  eq('fresh duel timeline spans all days', fresh.timeline.length, 30);
  eq('fresh duel has zero completed days', fresh.completedDays, 0);
  eq('fresh duel days are upcoming', fresh.timeline.every((t) => t.status === 'upcoming'), true);

  // 9 straight days with proof, day 10 is today, 20 upcoming.
  const joined = new Date(Date.now() - 9 * 86400000).toISOString();
  const posts = [];
  for (let d = 1; d <= 9; d++) {
    posts.push(
      makePost({
        id: `p${d}`,
        dayNumber: d,
        date: new Date(new Date(joined).getTime() + (d - 1) * 86400000).toISOString().slice(0, 10),
        mediaUrl: d % 2 === 0 ? `proofs/day${d}.mp4` : `proofs/day${d}.png`,
        mediaType: d % 2 === 0 ? 'video' : 'image',
      })
    );
  }
  const part = makeParticipation({ joinedAt: joined, currentStreak: 9, longestStreak: 9, completedDays: 9 });
  const rep = calculatePerformance(ch, part, posts);

  eq('completed days counted from check-ins', rep.completedDays, 9);
  eq('no missed days in a perfect run', rep.missedDays, 0);
  eq('today is pending', rep.pendingDays, 1);
  eq('remaining days are upcoming', rep.upcomingDays, 20);
  ok('score within 0..100', rep.score >= 0 && rep.score <= 100);
  ok('perfect run earns an S or A grade', ['S', 'A'].includes(rep.grade));
  eq('video proofs counted', rep.totalVideos, 4);
  eq('photo proofs counted', rep.totalPhotos, 5);
  eq('proof rate is 100% when every day has proof', rep.proofRate, 100);
  eq('timeline: day 1 completed', rep.timeline[0].status, 'completed');
  eq('timeline: day 10 pending', rep.timeline[9].status, 'pending');
  eq('timeline: day 21 upcoming', rep.timeline[20].status, 'upcoming');
  ok('summary mentions the streak', rep.summary.includes('9'));

  // A broken run: joined 20 days ago, only 5 days logged, 15 missed, day 21 today.
  const joined2 = new Date(Date.now() - 20 * 86400000).toISOString();
  const sparse = [];
  for (let d = 1; d <= 5; d++) {
    sparse.push(makePost({ id: `s${d}`, dayNumber: d, date: new Date(new Date(joined2).getTime() + (d - 1) * 86400000).toISOString().slice(0, 10) }));
  }
  const part2 = makeParticipation({ joinedAt: joined2, currentStreak: 0, longestStreak: 5, completedDays: 5 });
  const broken = calculatePerformance(ch, part2, sparse);
  eq('missed days detected', broken.missedDays, 15);
  ok('broken run scores below a perfect run', broken.score < rep.score);
  ok('broken run is graded D/C', ['D', 'C'].includes(broken.grade));
  eq('no proof → zero photos', broken.totalPhotos, 0);
}

/* ================================================================== */
console.log('\n3) Recommendation engine (affinity, ranking, diversity)');
/* ================================================================== */
{
  const db = emptyDB();
  db.categories = [
    { id: 'coding', name: 'Coding & Building', emoji: '💻', color: '#22d3ee', tagline: '', sort: 1 },
    { id: 'fitness', name: 'Fitness & Movement', emoji: '🏋️', color: '#f97316', tagline: '', sort: 2 },
    { id: 'reading', name: 'Reading & Learning', emoji: '📚', color: '#a78bfa', tagline: '', sort: 3 },
  ];

  const mk = (id, categoryId, over = {}) =>
    makeChallenge({ id, categoryId, participantCount: 10, likeCount: 5, viewCount: 50, ...over });

  db.challenges = [
    mk('c-coding-1', 'coding'),
    mk('c-coding-2', 'coding', { participantCount: 40, likeCount: 20, viewCount: 400 }),
    mk('c-fitness-1', 'fitness'),
    mk('c-reading-1', 'reading'),
    mk('c-reading-2', 'reading', { participantCount: 30, likeCount: 12, viewCount: 300 }),
    mk('c-joined', 'coding', { status: 'open' }),
    mk('c-closed', 'reading', { status: 'closed' }),
    mk('c-no', 'reading', { status: 'open' }),
  ];
  db.participants = [{ ...makeParticipation({ challengeId: 'c-joined' }) }];
  db.activities = [
    { id: 'a1', userId: 'me', action: 'join', challengeId: 'c-joined', categoryId: 'coding', createdAt: new Date().toISOString() },
    { id: 'a2', userId: 'me', action: 'like', challengeId: 'c-fitness-1', categoryId: 'fitness', createdAt: new Date().toISOString() },
    { id: 'a3', userId: 'me', action: 'not_interested', challengeId: 'c-no', categoryId: 'reading', createdAt: new Date().toISOString() },
    { id: 'a4', userId: 'someone-else', action: 'join', challengeId: 'c-reading-1', categoryId: 'reading', createdAt: new Date().toISOString() },
  ];
  db.searches = [
    { id: 's1', userId: 'me', query: 'running shoes', createdAt: new Date().toISOString() },
  ];

  const aff = computeAffinity(db, 'me');
  eq('affinity: own actions only (join + like = 2 interactions)', aff.interactions, 2);
  ok('affinity: coding scored from join', (aff.categories.coding ?? 0) > 0);
  ok('affinity: fitness scored from like', (aff.categories.fitness ?? 0) > 0);
  ok('affinity: explicit not-interested penalises the category', (aff.categories.reading ?? 0) < 0);
  eq('affinity: joined challenge recorded for explanations', aff.joinedTitles.coding?.[0], 'Challenge');

  const ranked = rankChallenges(db, 'me', 12);
  const ids = ranked.map((r) => r.id);
  ok('ranking: joined challenge excluded', !ids.includes('c-joined'));
  ok('ranking: closed challenge excluded', !ids.includes('c-closed'));
  ok('ranking: not-interested challenge excluded', !ids.includes('c-no'));
  ok('ranking: returns only valid candidates', ids.length === 5 && ids.every((id) => db.challenges.some((c) => c.id === id && c.status === 'open')));
  ok('ranking: each result carries a reason', ranked.every((r) => typeof r.reason === 'string' && r.reason.length > 0));
  ok('ranking: scores are finite numbers', ranked.every((r) => Number.isFinite(r.score)));

  // A brand-new user with zero history still gets a full, diverse page.
  const freshRanked = rankChallenges(db, 'fresh-user', 12);
  ok('new user: still gets all open candidates (only closed excluded)', freshRanked.length === 7);
  ok(
    'new user: reasons are popularity/staff picks, never "because you joined"',
    freshRanked.every((r) => !r.reason.startsWith('Because you joined'))
  );

  const trend = trendingCategories(db, 6);
  ok('trending: returns ranked categories', trend.length === 3);
  ok(
    'trending: sorted by participant volume descending',
    trend.every((t, i) => i === 0 || trend[i - 1].participants >= t.participants)
  );
  eq('trending: aggregates challenge counts', trend.find((t) => t.categoryId === 'coding')?.challengeCount, 3);
}

console.log(`\n✅ ALL ${passed} ASSERTIONS PASSED\n`);
process.exit(0);
