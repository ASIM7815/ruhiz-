import type { Challenge, Checkin, Participation } from './types';
import { isoDay } from './seed';

export interface DayTimelineItem {
  dayNumber: number;
  status: 'completed' | 'missed' | 'pending' | 'upcoming';
  dateStr: string; // ISO date YYYY-MM-DD
  checkin?: Checkin;
}

export interface PerformanceReport {
  score: number; // 0 to 100
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  gradeLabel: string;
  gradeColor: string;
  completedDays: number;
  missedDays: number;
  pendingDays: number;
  upcomingDays: number;
  totalDays: number;
  elapsedDays: number;
  consistencyRate: number; // 0 to 100
  completionRate: number; // 0 to 100
  proofRate: number; // 0 to 100
  currentStreak: number;
  longestStreak: number;
  totalCheckinsWithProof: number;
  totalVideos: number;
  totalPhotos: number;
  summary: string;
  timeline: DayTimelineItem[];
}

/**
 * Automatically computes a real-time performance score and day-by-day timeline
 * based on actual check-ins, consistency, completed days, missed days, and proof quality.
 */
export function calculatePerformance(
  challenge: Challenge,
  participation: Participation | null,
  checkins: Checkin[]
): PerformanceReport {
  const totalDays = Math.max(1, challenge.durationDays);
  const myCheckins = checkins
    .filter((c) => c.challengeId === challenge.id)
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const checkinByDay = new Map<number, Checkin>();
  for (const ck of myCheckins) {
    checkinByDay.set(ck.dayNumber, ck);
  }

  const todayStr = isoDay(0);
  const joinedDate = participation ? new Date(participation.joinedAt) : new Date();

  const timeline: DayTimelineItem[] = [];
  let completedDays = 0;
  let missedDays = 0;
  let pendingDays = 0;
  let upcomingDays = 0;

  for (let d = 1; d <= totalDays; d++) {
    const existing = checkinByDay.get(d);
    // Target date estimation: joinedDate + (d - 1) days
    const dayDate = new Date(joinedDate.getTime() + (d - 1) * 86400000);
    const dayDateStr = existing?.date ?? dayDate.toISOString().slice(0, 10);

    let status: DayTimelineItem['status'];
    if (existing) {
      status = 'completed';
      completedDays++;
    } else if (!participation) {
      status = 'upcoming';
      upcomingDays++;
    } else if (participation.status === 'completed') {
      status = 'missed';
      missedDays++;
    } else {
      // Determine based on calendar date vs today
      if (dayDateStr === todayStr) {
        status = 'pending';
        pendingDays++;
      } else if (dayDateStr < todayStr) {
        status = 'missed';
        missedDays++;
      } else {
        status = 'upcoming';
        upcomingDays++;
      }
    }

    timeline.push({
      dayNumber: d,
      status,
      dateStr: dayDateStr,
      checkin: existing,
    });
  }

  const elapsedDays = Math.min(totalDays, completedDays + missedDays + (pendingDays > 0 ? 1 : 0));
  const currentStreak = participation?.currentStreak ?? 0;
  const longestStreak = participation?.longestStreak ?? 0;

  // Proof counts
  const totalVideos = myCheckins.filter((c) => c.mediaType === 'video' && Boolean(c.mediaUrl)).length;
  const totalPhotos = myCheckins.filter((c) => c.mediaType === 'image' && Boolean(c.mediaUrl)).length;
  const totalCheckinsWithProof = totalVideos + totalPhotos;

  const proofRate = completedDays > 0 ? Math.round((totalCheckinsWithProof / completedDays) * 100) : 0;
  const completionRate = elapsedDays > 0 ? Math.min(100, Math.round((completedDays / elapsedDays) * 100)) : 0;

  // Consistency rate based on longest streak relative to elapsed days
  const consistencyRate =
    elapsedDays <= 1
      ? completedDays === 1 ? 100 : 100
      : Math.min(100, Math.round((longestStreak / Math.max(1, elapsedDays)) * 100));

  // Dynamic Performance Score (0 - 100)
  let score: number;
  if (completedDays === 0 && missedDays === 0) {
    score = 100; // Fresh duel, clean slate
  } else {
    const raw = completionRate * 0.55 + consistencyRate * 0.30 + proofRate * 0.15;
    const penalty = missedDays * 3.5;
    score = Math.max(0, Math.min(100, Math.round(raw - penalty)));
  }

  // Grade classification
  let grade: PerformanceReport['grade'];
  let gradeLabel: string;
  let gradeColor: string;

  if (score >= 90) {
    grade = 'S';
    gradeLabel = 'Elite';
    gradeColor = '#16e08a';
  } else if (score >= 80) {
    grade = 'A';
    gradeLabel = 'Strong';
    gradeColor = '#22d3ee';
  } else if (score >= 70) {
    grade = 'B';
    gradeLabel = 'Consistent';
    gradeColor = '#a78bfa';
  } else if (score >= 55) {
    grade = 'C';
    gradeLabel = 'Developing';
    gradeColor = '#facc15';
  } else {
    grade = 'D';
    gradeLabel = 'Needs Focus';
    gradeColor = '#f43f5e';
  }

  // Summary message
  let summary = '';
  if (completedDays === 0 && missedDays === 0) {
    summary = 'Day 1 is open. Upload your first proof to start your streak!';
  } else if (missedDays === 0 && completedDays > 0) {
    summary = `Flawless record: ${completedDays} of ${completedDays} active days logged with an unbroken streak of ${currentStreak} days!`;
  } else if (missedDays > 0 && currentStreak > 0) {
    summary = `Solid bounce-back: ${completedDays} days done (${missedDays} missed), currently on a ${currentStreak}-day streak.`;
  } else if (missedDays > 0) {
    summary = `${completedDays} days completed, ${missedDays} days missed. Upload today's proof to restart your streak.`;
  } else {
    summary = `${completedDays} of ${totalDays} days completed.`;
  }

  return {
    score,
    grade,
    gradeLabel,
    gradeColor,
    completedDays,
    missedDays,
    pendingDays,
    upcomingDays,
    totalDays,
    elapsedDays,
    consistencyRate,
    completionRate,
    proofRate,
    currentStreak,
    longestStreak,
    totalCheckinsWithProof,
    totalVideos,
    totalPhotos,
    summary,
    timeline,
  };
}
