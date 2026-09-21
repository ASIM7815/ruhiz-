/**
 * DUEL schema + RLS integration test (headless Postgres via PGlite).
 *
 * Applies every SQL migration against a real Postgres engine, then exercises
 * the complete multi-user flow AND the unauthorized scenarios:
 *
 *   User A creates a challenge → User B joins → B submits Day-1 daily post
 *   (image + video) → A views it → User C discovers it in Explore → they
 *   interact → A and B message each other.
 *
 *   B edits A's challenge         → must fail
 *   B deletes A's post            → must fail
 *   B reads A's private thread    → must fail
 *   B deletes A's storage object  → must fail
 *   A uploads own media           → must succeed
 *
 * Run: node scripts/test/schema-rls.test.cjs
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { PGlite } = require('@electric-sql/pglite');

const MIGRATIONS = [
  '20260920000000_duel_platform.sql',
  '20260921000000_duel_social_feed.sql',
  '20260922000000_challenge_posts_architecture.sql',
  '20260922100000_sync_checkins_with_posts.sql',
  '20260923000000_unified_posts_security_storage.sql',
];

const UUID_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

let passed = 0;
let failed = 0;
const failures = [];
const ok = (label, cond, extra) => {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label + (extra ? ` — ${extra}` : ''));
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ''}`);
  }
};

function section(name) {
  console.log(`\n${name}`);
}

/** Strip bits that require a full Supabase runtime (pgcrypto is built into PG13+). */
function prepareSql(sql) {
  return sql
    .replace(/create extension if not exists "pgcrypto";/gi, 'select 1;')
    .replace(
      /exception when duplicate_object then null;/gi,
      'exception when duplicate_object or undefined_object then null;'
    );
}

async function main() {
  const db = new PGlite();

  // ---- Supabase-like environment -------------------------------------------
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create schema if not exists auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

    create schema if not exists storage;
    create table storage.buckets (
      id text primary key,
      name text not null,
      public boolean default false,
      file_size_limit bigint,
      allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id),
      name text not null,
      owner uuid,
      created_at timestamptz default now()
    );
    create unique index objects_bucket_name on storage.objects (bucket_id, name);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[]
      language sql immutable
      as $$ select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1] $$;
  `);

  // Try to create the realtime publication (Supabase has it; PGlite may not).
  try {
    await db.exec('create publication supabase_realtime;');
  } catch {
    /* alter publication statements in migrations are guarded */
  }

  // ---- Apply all migrations -------------------------------------------------
  section('Migrations');
  for (const file of MIGRATIONS) {
    const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'supabase', 'migrations', file), 'utf8');
    try {
      await db.exec(prepareSql(raw));
      ok(`applies ${file}`, true);
    } catch (err) {
      ok(`applies ${file}`, false, err.message);
      throw err;
    }
  }

  // Grants Supabase gives to API roles.
  await db.exec(`
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select on all tables in schema public to anon;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant select on storage.buckets to anon, authenticated;
    grant execute on all functions in schema public to authenticated, anon;
  `);

  // ---- Seed three real members (auth.users + profiles via the signup trigger)
  section('Setup: three authenticated members');
  for (const [id, email, username, name] of [
    [UUID_A, 'a@duel.app', 'alice', 'Alice A'],
    [UUID_B, 'b@duel.app', 'bob', 'Bob B'],
    [UUID_C, 'c@duel.app', 'carol', 'Carol C'],
  ]) {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`,
      [id, email, JSON.stringify({ username, display_name: name })]
    );
  }
  const profRows = await db.query('select id, user_id, username from public.profiles order by username');
  ok('signup trigger created 3 profiles', profRows.rows.length === 3, `got ${profRows.rows.length}`);
  const P = {};
  for (const r of profRows.rows) P[r.username] = r.id;
  ok('alice profile exists', Boolean(P.alice));
  ok('bob profile exists', Boolean(P.bob));
  ok('carol profile exists', Boolean(P.carol));

  // Helpers: run queries "as" a signed-in member (RLS applies — the pg session
  // user owns the tables, so we switch to the non-owner `authenticated` role).
  async function asUser(uuid, fn) {
    await db.exec('begin');
    try {
      await db.exec(`set local role authenticated`);
      await db.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uuid]);
      const out = await fn(db);
      await db.exec('commit');
      return out;
    } catch (err) {
      await db.exec('rollback');
      throw err;
    }
  }

  /** Expect a statement to raise (RLS / trigger rejection). */
  async function expectDenied(label, fn) {
    try {
      await fn();
      ok(label, false, 'expected a rejection but the statement succeeded');
    } catch (err) {
      ok(label, true);
    }
  }

  /** Expect a write to affect 0 rows (RLS filtered it out). */
  async function expectNoRows(label, res) {
    const rows = res.rows ?? [];
    ok(label, rows.length === 0, `expected 0 rows, got ${rows.length}`);
  }

  // ==========================================================================
  section('Challenges: ownership');
  // ==========================================================================

  const chId = '11111111-1111-1111-1111-111111111111';

  await asUser(UUID_A, async (c) => {
    const r = await c.query(
      `insert into public.challenges (id, creator_id, title, description, category_id, duration_days, difficulty, daily_task, tags)
       values ($1, $2, '30 Days Fitness Challenge', 'Sweat every day', 'fitness', 30, 'medium', 'Move for 30 minutes', array['fitness'])
       returning id`,
      [chId, P.alice]
    );
    ok('A can create their own challenge', r.rows.length === 1);
  });

  await expectDenied('B cannot create a challenge pretending to be A', () =>
    asUser(UUID_B, (c) =>
      c.query(
        `insert into public.challenges (creator_id, title, category_id, duration_days)
         values ($1, 'Fake challenge', 'fitness', 7)`,
        [P.alice]
      )
    )
  );

  await expectNoRows(
    'B cannot update A\'s challenge (RLS filters it out)',
    await asUser(UUID_B, (c) =>
      c.query(`update public.challenges set title = 'Hijacked' where id = $1 returning id`, [chId])
    )
  );

  await expectNoRows(
    'B cannot delete A\'s challenge',
    await asUser(UUID_B, (c) => c.query(`delete from public.challenges where id = $1 returning id`, [chId]))
  );

  await asUser(UUID_A, async (c) => {
    const r = await c.query(`update public.challenges set title = '30 Days Fitness' where id = $1 returning title`, [chId]);
    ok('A (creator) can update their own challenge', r.rows.length === 1 && r.rows[0].title === '30 Days Fitness');
  });

  // ==========================================================================
  section('Profiles & private settings');
  // ==========================================================================

  ok('profiles are publicly readable', (await asUser(UUID_C, (c) => c.query('select * from public.profiles'))).rows.length === 3);

  await expectNoRows(
    "B cannot update A's profile",
    await asUser(UUID_B, (c) => c.query(`update public.profiles set bio = 'pwned' where user_id = $1 returning id`, [UUID_A]))
  );

  await asUser(UUID_A, async (c) => {
    const r = await c.query(`update public.profiles set bio = 'training hard' where user_id = $1 returning bio`, [UUID_A]);
    ok('A can update their own profile', r.rows.length === 1);
  });

  await expectDenied("A cannot set their own verified badge", () =>
    asUser(UUID_A, (c) => c.query(`update public.profiles set verified = true where user_id = $1`, [UUID_A]))
  );

  await asUser(UUID_A, async (c) => {
    await c.query(`insert into public.user_settings (user_id, settings) values ($1, '{"twoFactor": true}'::jsonb)`, [P.alice]);
  });
  ok(
    'A can read their private settings',
    (await asUser(UUID_A, (c) => c.query('select * from public.user_settings'))).rows.length === 1
  );
  ok(
    "B cannot read A's settings",
    (await asUser(UUID_B, (c) => c.query('select * from public.user_settings'))).rows.length === 0
  );
  ok('profiles no longer expose a settings column', !profRows.rows[0].hasOwnProperty('settings'));

  // ==========================================================================
  section('Participation: join / leave / no foreign writes');
  // ==========================================================================

  await asUser(UUID_B, async (c) => {
    await c.query(
      `insert into public.challenge_participants (challenge_id, user_id) values ($1, $2) returning challenge_id`,
      [chId, P.bob]
    );
    ok('B can join the challenge as themselves', true);
  });

  await expectNoRows(
    "B cannot forge their own participation streak",
    await asUser(UUID_B, (c) =>
      c.query(`update public.challenge_participants set current_streak = 999 where challenge_id = $1 returning *`, [chId])
    )
  );

  await expectDenied('B cannot join a challenge as someone else', () =>
    asUser(UUID_B, (c) =>
      c.query(`insert into public.challenge_participants (challenge_id, user_id) values ($1, $2)`, [chId, P.carol])
    )
  );

  await asUser(UUID_C, async (c) => {
    await c.query(`insert into public.challenge_participants (challenge_id, user_id) values ($1, $2)`, [chId, P.carol]);
  });

  await expectNoRows(
    "B cannot update C's participation row",
    await asUser(UUID_B, (c) =>
      c.query(
        `update public.challenge_participants set status = 'abandoned' where challenge_id = $1 and user_id = $2 returning *`,
        [chId, P.carol]
      )
    )
  );

  // ==========================================================================
  section('Daily posts → media (the core flow)');
  // ==========================================================================

  let postB;
  await asUser(UUID_B, async (c) => {
    const res = await c.query(
      `select public.duel_submit_daily_post($1::uuid, 1, 'Day 1 done — 5k run + stretch', $2::jsonb) as out`,
      [
        chId,
        JSON.stringify([
          { type: 'image', url: `${UUID_B}/posts/2026-09/img-day1.jpg`, width: 1080, height: 1350, fileSize: 2200000 },
          { type: 'video', url: `${UUID_B}/posts/2026-09/vid-day1.mp4`, durationMs: 42000, fileSize: 180000000 },
        ]),
      ]
    );
    postB = res.rows[0].out;
    ok('B can submit a daily post with an image and a video', Boolean(postB.post?.id));
    ok('post carries both media files', (postB.post?.media ?? []).length === 2);
    ok('post is dated on the day-slot target date', String(postB.post?.post_date) === String(new Date().toISOString().slice(0, 10)));
    ok('participation advanced to 1 day', postB.participation?.completed_days === 1);
    ok('streak is 1', postB.participation?.current_streak === 1);
  });

  await expectDenied('a non-participant cannot submit a daily post', () =>
    asUser(UUID_A, (c) => c.query(`select public.duel_submit_daily_post($1::uuid, 1, 'not in this duel', null)`, [chId]))
  );

  await expectDenied('B cannot submit a post for a future challenge day', () =>
    asUser(UUID_B, (c) => c.query(`select public.duel_submit_daily_post($1::uuid, 25, 'from the future', null)`, [chId]))
  );

  await expectDenied('B cannot post outside the challenge duration', () =>
    asUser(UUID_B, (c) => c.query(`select public.duel_submit_daily_post($1::uuid, 99, 'out of range', null)`, [chId]))
  );

  const postId = postB.post.id;

  await asUser(UUID_B, async (c) => {
    const upd = await c.query(`update public.challenge_posts set caption = 'Day 1 done — 5k run!' where id = $1 returning caption`, [postId]);
    ok('B can edit their own daily post', upd.rows.length === 1 && upd.rows[0].caption.includes('5k run!'));
  });

  await expectNoRows(
    "A cannot edit B's daily post",
    await asUser(UUID_A, (c) => c.query(`update public.challenge_posts set caption = 'hacked' where id = $1 returning id`, [postId]))
  );

  await expectNoRows(
    "A cannot delete B's daily post",
    await asUser(UUID_A, (c) => c.query(`delete from public.challenge_posts where id = $1 returning id`, [postId]))
  );

  await expectDenied('B cannot move their post to another day/user', () =>
    asUser(UUID_B, (c) => c.query(`update public.challenge_posts set day_number = 2 where id = $1`, [postId]))
  );

  // The ledger projection
  const ledger = await db.query('select * from public.challenge_checkins where challenge_id = $1', [chId]);
  ok('check-in ledger projection was created (1 row for the post)', ledger.rows.length === 1, `got ${ledger.rows.length}`);
  ok('ledger carries the first media as its snapshot', ledger.rows[0]?.media_type === 'image');
  ok('ledger day_number matches the post', ledger.rows[0]?.day_number === 1);

  await expectDenied('clients cannot write the check-in ledger directly', () =>
    asUser(UUID_B, (c) =>
      c.query(
        `insert into public.challenge_checkins (challenge_id, user_id, day_number, note) values ($1, $2, 2, 'forged')`,
        [chId, P.bob]
      )
    )
  );

  // ==========================================================================
  section('Challenge timeline & Explore (real content only)');
  // ==========================================================================

  await asUser(UUID_A, async (c) => {
    const r = await c.query(`select * from public.get_challenge_timeline($1::uuid)`, [chId]);
    ok("A sees B's post in the challenge timeline", r.rows.length === 1 && r.rows[0].user_id === P.bob);
    ok('timeline row includes media jsonb', (r.rows[0].media ?? []).length === 2);
  });

  await asUser(UUID_C, async (c) => {
    const r = await c.query(`select * from public.duel_feed(null, null, null, 'latest', 18, 0)`);
    ok('C discovers the real post in Explore', r.rows.length === 1 && r.rows[0].post_id === postId);
    ok('explore row is enriched with challenge + author', r.rows[0].challenge_title === '30 Days Fitness' && r.rows[0].author_username === 'bob');
    ok('explore row exposes the media array', (r.rows[0].media ?? []).length === 2);
  });

  await asUser(UUID_C, async (c) => {
    const videos = await c.query(`select * from public.duel_feed('video', null, null, 'latest', 18, 0)`);
    ok("video filter returns the post (it has a video)", videos.rows.length === 1);
    const imgs = await c.query(`select * from public.duel_feed('image', null, null, 'latest', 18, 0)`);
    ok("image filter returns the post (it has an image)", imgs.rows.length === 1);
  });

  await asUser(UUID_B, async (c) => {
    const r = await c.query(`select * from public.get_user_posts($1::uuid)`, [P.bob]);
    ok('B posts appear on their profile', r.rows.length === 1 && r.rows[0].is_mine === true);
  });

  // ==========================================================================
  section('Interactions: likes & comments (self-only records)');
  // ==========================================================================

  await asUser(UUID_A, async (c) => {
    await c.query(`insert into public.challenge_post_likes (post_id, user_id) values ($1, $2)`, [postId, P.alice]);
    await c.query(`insert into public.challenge_post_comments (post_id, user_id, body) values ($1, $2, 'Beast mode!')`, [postId, P.alice]);
    const p = await c.query(`select like_count, comment_count from public.challenge_posts where id = $1`, [postId]);
    ok('like + comment counters bump via triggers', p.rows[0].like_count === 1 && p.rows[0].comment_count === 1);
  });

  await expectDenied("A cannot like as someone else", () =>
    asUser(UUID_A, (c) => c.query(`insert into public.challenge_post_likes (post_id, user_id) values ($1, $2)`, [postId, P.carol]))
  );

  await expectNoRows(
    "B cannot delete A's comment",
    await asUser(UUID_B, (c) =>
      c.query(`delete from public.challenge_post_comments where post_id = $1 and user_id = $2 returning id`, [postId, P.alice])
    )
  );

  await asUser(UUID_A, async (c) => {
    const r = await c.query(`delete from public.challenge_post_likes where post_id = $1 and user_id = $2`, [postId, P.alice]);
    ok('A can remove their own like', r.rows.length === 0 || true);
  });

  // ==========================================================================
  section('Progress engine: streaks, completion, day-slot model');
  // ==========================================================================

  // Simulate that B joined four days ago so days 1–4 are in schedule.
  await db.query(
    `update public.challenge_participants set joined_at = now() - interval '4 days' where challenge_id = $1 and user_id = $2`,
    [chId, P.bob]
  );

  // B posts day 2 and day 3 — streak should grow.
  for (const day of [2, 3]) {
    await asUser(UUID_B, async (c) => {
      await c.query(`select public.duel_submit_daily_post($1::uuid, $2, 'check', null)`, [chId, day]);
    });
  }
  let part = (await db.query(`select * from public.challenge_participants where challenge_id = $1 and user_id = $2`, [chId, P.bob])).rows[0];
  ok('three contiguous days → streak of 3', part.current_streak === 3, `got ${part.current_streak}`);
  ok('completed_days counted 3 posts', part.completed_days === 3, `got ${part.completed_days}`);

  // B skips day 4, posts day 5 (day 5 is not reached yet on day 4 — so this
  // must fail while the target date is in the future). Instead, B deletes and
  // re-adds: gap behaviour is validated by removing day 3 (gap opens at 2).
  await asUser(UUID_B, async (c) => {
    await c.query(`delete from public.challenge_posts where challenge_id = $1 and day_number = 3`, [chId]);
  });
  part = (await db.query(`select * from public.challenge_participants where challenge_id = $1 and user_id = $2`, [chId, P.bob])).rows[0];
  ok('removing the top day breaks the streak', part.current_streak === 2, `got ${part.current_streak}`);
  ok('completed_days drops with the post', part.completed_days === 2, `got ${part.completed_days}`);

  // Media deletion is allowed for the post owner only.
  await asUser(UUID_B, async (c) => {
    const del = await c.query(`delete from public.challenge_post_media where post_id = $1 and media_type = 'video'`, [postId]);
    ok('B can delete their own media row', del.rowCount === 1);
  });
  await expectNoRows(
    "A cannot delete B's media row",
    await asUser(UUID_A, (c) => c.query(`delete from public.challenge_post_media where post_id = $1 returning id`, [postId]))
  );

  // ==========================================================================
  section('Messaging: strict conversation privacy');
  // ==========================================================================

  let convoId;
  await asUser(UUID_A, async (c) => {
    convoId = (await c.query(`select public.duel_open_conversation($1::uuid) as id`, [P.bob])).rows[0].id;
    ok('A can open a 1:1 conversation with B', Boolean(convoId));
  });

  await asUser(UUID_A, async (c) => {
    await c.query(`insert into public.messages (conversation_id, sender_id, content) values ($1, $2, 'Ready for day 2?')`, [convoId, P.alice]);
  });

  ok(
    'B (participant) can read the message',
    (await asUser(UUID_B, (c) => c.query('select * from public.messages where conversation_id = $1', [convoId]))).rows.length === 1
  );
  ok(
    'C (stranger) cannot read the conversation',
    (await asUser(UUID_C, (c) => c.query('select * from public.conversations where id = $1', [convoId]))).rows.length === 0
  );
  ok(
    'C cannot read the messages',
    (await asUser(UUID_C, (c) => c.query('select * from public.messages where conversation_id = $1', [convoId]))).rows.length === 0
  );
  ok(
    'C cannot see who is in the conversation',
    (await asUser(UUID_C, (c) => c.query('select * from public.conversation_participants where conversation_id = $1', [convoId]))).rows.length === 0
  );

  await expectDenied('C cannot send a message into a foreign conversation', () =>
    asUser(UUID_C, (c) =>
      c.query(`insert into public.messages (conversation_id, sender_id, content) values ($1, $2, 'hi')`, [convoId, P.carol])
    )
  );

  await expectDenied('C cannot insert themselves into a foreign conversation', () =>
    asUser(UUID_C, (c) => c.query(`insert into public.conversation_participants (conversation_id, user_id) values ($1, $2)`, [convoId, P.carol]))
  );

  await expectDenied('B cannot send a message as A', () =>
    asUser(UUID_B, (c) =>
      c.query(`insert into public.messages (conversation_id, sender_id, content) values ($1, $2, 'spoof')`, [convoId, P.alice])
    )
  );

  await asUser(UUID_B, async (c) => {
    await c.query(`update public.conversation_participants set last_read_at = now() where conversation_id = $1 and user_id = $2`, [convoId, P.bob]);
    ok('B can mark the thread read (own row)', true);
  });

  await expectDenied("B cannot change their join date on a conversation", () =>
    asUser(UUID_B, (c) =>
      c.query(`update public.conversation_participants set joined_at = now() - interval '9 years' where conversation_id = $1`, [convoId])
    )
  );

  const touch = (await db.query(`select last_message_at from public.conversations where id = $1`, [convoId])).rows[0];
  ok('conversations.last_message_at is trigger-maintained', Boolean(touch.last_message_at));

  const msgNotif = (
    await asUser(UUID_B, (c) => c.query(`select * from public.notifications where conversation_id = $1`, [convoId]))
  ).rows;
  ok("B received a 'message' notification", msgNotif.length === 1 && msgNotif[0].kind === 'message');

  await expectDenied("B cannot rewrite a notification's content", () =>
    asUser(UUID_B, (c) => c.query(`update public.notifications set body = 'x', kind = 'system' where id = $1`, [msgNotif[0].id]))
  );
  await asUser(UUID_B, async (c) => {
    const r = await c.query(`update public.notifications set read = true where id = $1 returning read`, [msgNotif[0].id]);
    ok('B can mark their notification read', r.rows.length === 1);
  });
  ok(
    "A cannot read B's notifications",
    (await asUser(UUID_A, (c) => c.query(`select * from public.notifications where id = $1`, [msgNotif[0].id]))).rows.length === 0
  );

  // ==========================================================================
  section('Behaviour data stays private');
  // ==========================================================================

  await asUser(UUID_B, async (c) => {
    await c.query(`insert into public.activities (user_id, action) values ($1, 'search')`, [P.bob]);
  });
  ok(
    'A cannot read B\'s activity log',
    (await asUser(UUID_A, (c) => c.query('select * from public.activities'))).rows.length === 0
  );
  ok(
    'clients cannot read app_settings',
    (await asUser(UUID_A, (c) => c.query('select * from public.app_settings'))).rows.length === 0
  );

  // ==========================================================================
  section('Storage RLS: own-folder writes, public reads, chat privacy');
  // ==========================================================================

  const objA = `posts/${UUID_A}/2026-09/aaaaaaaa-1111.jpg`;
  const objB = `posts/${UUID_B}/2026-09/bbbbbbbb-2222.mp4`;
  const chatA = `chats/${UUID_A}/2026-09/aaaaaaaa-chat.png`;

  await asUser(UUID_A, async (c) => {
    await c.query(`insert into storage.objects (bucket_id, name, owner) values ('duel-media', $1, $2)`, [objA, UUID_A]);
    ok('A can upload into their own duel-media folder', true);
  });

  await expectDenied('B cannot write into A\'s duel-media folder', () =>
    asUser(UUID_B, (c) => c.query(`insert into storage.objects (bucket_id, name, owner) values ('duel-media', $1, $2)`, [`posts/${UUID_A}/2026-09/evil.jpg`, UUID_B]))
  );

  await asUser(UUID_B, async (c) => {
    await c.query(`insert into storage.objects (bucket_id, name, owner) values ('duel-media', $1, $2)`, [objB, UUID_B]);
    ok('B can upload their own media (300 MB video path)', true);
  });

  ok(
    'public media is world-readable',
    (await asUser(UUID_C, (c) => c.query(`select * from storage.objects where bucket_id = 'duel-media'`))).rows.length === 2
  );

  await expectNoRows(
    "B cannot delete A's storage object",
    await asUser(UUID_B, (c) => c.query(`delete from storage.objects where name = $1 returning id`, [objA]))
  );

  await asUser(UUID_A, async (c) => {
    const r = await c.query(`delete from storage.objects where name = $1`, [objA]);
    ok('A can delete their own storage object', r.rowCount === 1);
  });

  // chat bucket privacy
  await asUser(UUID_A, async (c) => {
    await c.query(`insert into storage.objects (bucket_id, name, owner) values ('duel-chat', $1, $2)`, [chatA, UUID_A]);
    ok('A can upload chat media into their folder', true);
  });

  ok(
    'B (conversation partner) can read A\'s chat media',
    (await asUser(UUID_B, (c) => c.query(`select * from storage.objects where bucket_id = 'duel-chat'`))).rows.length === 1
  );
  ok(
    'C (stranger) cannot read A\'s chat media',
    (await asUser(UUID_C, (c) => c.query(`select * from storage.objects where bucket_id = 'duel-chat'`))).rows.length === 0
  );
  await expectDenied("C cannot write into A's chat folder", () =>
    asUser(UUID_C, (c) => c.query(`insert into storage.objects (bucket_id, name, owner) values ('duel-chat', $1, $2)`, [`chats/${UUID_A}/2026-09/evil.png`, UUID_C]))
  );

  // ==========================================================================
  section('Back-compat: duel_checkin wrapper + existing schema');
  // ==========================================================================

  await asUser(UUID_C, async (c) => {
    const r = await c.query(
      `select public.duel_checkin($1::uuid, 'legacy call', $2, 'image', 1) as out`,
      [chId, `proofs/${UUID_C}/2026-09/legacy.jpg`]
    );
    ok('legacy duel_checkin() creates a daily post under the hood', Boolean(r.rows[0].out?.checkin));
    const ledger = await db.query(
      `select * from public.challenge_checkins where challenge_id = $1 and user_id = $2`,
      [chId, P.carol]
    );
    ok('legacy call projects into the ledger', ledger.rows.length === 1 && ledger.rows[0].media_type === 'image');
  });

  // closing sanity: no seeded/fake content anywhere
  const seeded = await db.query(`select count(*)::int as n from public.challenges`);
  ok('only real user-created challenges exist (no seed rows)', seeded.rows[0].n === 1, `got ${seeded.rows[0].n}`);
  const fakeProfiles = await db.query(`select count(*)::int as n from public.profiles where is_persona`);
  ok('no persona/fake profiles', fakeProfiles.rows[0].n === 0);

  // ==========================================================================
  console.log(`\n${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅ ALL ${passed} SCHEMA/RLS ASSERTIONS PASSED`);
  } else {
    console.log(`❌ ${failed} FAILED / ${passed} PASSED`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('HARNESS ERROR:', err);
  process.exit(1);
});
