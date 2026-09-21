import type { Category } from './types';

/**
 * DUEL category taxonomy — a shared constant that mirrors
 * supabase/migrations/20260920000000_duel_platform.sql.
 *
 * Categories are a fixed taxonomy (not user content): they are seeded into
 * `duel_categories` by the migration, and this constant is used as a
 * reference for the landing page and for validating new challenges before
 * the database list has loaded. No users, challenges or posts are seeded —
 * all content is created by real members and rendered from the database.
 */
export const SEED_CATEGORIES: Category[] = [
  { id: 'coding', name: 'Coding & Building', emoji: '💻', color: '#22d3ee', tagline: 'Ship something every day', sort: 1 },
  { id: 'fitness', name: 'Fitness & Movement', emoji: '🏋️', color: '#f97316', tagline: 'Stronger, faster, further', sort: 2 },
  { id: 'reading', name: 'Reading & Learning', emoji: '📚', color: '#a78bfa', tagline: 'Pages turn into perspective', sort: 3 },
  { id: 'detox', name: 'Digital Detox', emoji: '📵', color: '#f43f5e', tagline: 'Reclaim your attention', sort: 4 },
  { id: 'mindfulness', name: 'Mindfulness & Focus', emoji: '🧘', color: '#34d399', tagline: 'Train the muscle between your ears', sort: 5 },
  { id: 'nutrition', name: 'Nutrition & Sleep', emoji: '🥗', color: '#84cc16', tagline: 'Fuel and recovery done right', sort: 6 },
  { id: 'creativity', name: 'Creativity & Craft', emoji: '🎨', color: '#f472b6', tagline: 'Make things, badly then brilliantly', sort: 7 },
  { id: 'finance', name: 'Money & Discipline', emoji: '💰', color: '#facc15', tagline: 'Small daily wins, compounding', sort: 8 },
  { id: 'language', name: 'Languages', emoji: '🗣️', color: '#60a5fa', tagline: 'Ten words a day adds up', sort: 9 },
  { id: 'outdoors', name: 'Outdoors & Adventure', emoji: '⛰️', color: '#2dd4bf', tagline: 'Get outside, every single day', sort: 10 },
];

/** Local YYYY-MM-DD for `offsetFromToday` days from now (0 = today). */
export function isoDay(offsetFromToday: number): string {
  const d = new Date(Date.now() + offsetFromToday * 86400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
