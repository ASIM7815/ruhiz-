import type { Category, Challenge, ChallengeComment, Checkin, Participation } from './types';
import type { UserProfile } from '@/lib/types';

/** DUEL category taxonomy — mirrors supabase/migrations/20260920000000_duel_platform.sql */
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

/**
 * No fake users/personas are generated. All user accounts are created by real
 * authenticated sign-ups.
 */
export const SEED_PROFILES: UserProfile[] = [];

/**
 * No fake challenges or starter posts. Content only exists when created by real users.
 */
export const SEED_CHALLENGES: Challenge[] = [];

/**
 * No fake comments.
 */
export const SEED_COMMENTS: ChallengeComment[] = [];

/**
 * No pre-existing fake participations or check-ins.
 */
export function seedParticipation(): { participants: Participation[]; checkins: Checkin[] } {
  return { participants: [], checkins: [] };
}

export function isoDay(offsetFromToday: number): string {
  const d = new Date(Date.now() + offsetFromToday * 86400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
