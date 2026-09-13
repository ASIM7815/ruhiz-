import type { ProblemCategory } from '@/lib/types';

/**
 * Ruhiz problem taxonomy.
 *
 * Every category carries a curated keyword list. Classification is fully
 * deterministic: the same post text always produces the same categories.
 * This list is mirrored 1:1 in supabase/migrations (table `problems`) where a
 * Postgres trigger performs the same classification server-side — keep both
 * in sync when editing.
 */
export const PROBLEMS: ProblemCategory[] = [
  {
    id: 'anxiety',
    label: 'Anxiety & Overthinking',
    emoji: '🌀',
    keywords: [
      'anxiety', 'anxious', 'panic', 'overthinking', 'overthink', 'overthinker',
      'worried', 'worry', 'stressed', 'stress', 'nervous', 'racing', 'grounding',
      'calm', 'breathe', 'breathing', 'spiral', 'spiraling',
    ],
  },
  {
    id: 'mood',
    label: 'Low Mood & Depression',
    emoji: '🌧️',
    keywords: [
      'depression', 'depressed', 'depressing', 'sad', 'sadness', 'numb', 'empty',
      'hopeless', 'crying', 'cried', 'tears', 'unmotivated', 'mental', 'therapy',
      'therapist', 'mentalhealth', 'dark', 'heavy',
    ],
  },
  {
    id: 'burnout',
    label: 'Burnout & Exhaustion',
    emoji: '🔥',
    keywords: [
      'burnout', 'burned', 'burnt', 'exhausted', 'exhaustion', 'drained',
      'overworked', 'overwhelm', 'overwhelmed', 'tired', 'fatigue', 'deadline',
      'workload',
    ],
  },
  {
    id: 'studying',
    label: 'Studying & Exams',
    emoji: '📚',
    keywords: [
      'study', 'studying', 'exam', 'exams', 'finals', 'mock', 'test', 'tests',
      'grades', 'grade', 'college', 'university', 'school', 'homework',
      'assignment', 'revision', 'revise', 'semester', 'flashcards', 'med',
      'anatomy', 'notes',
    ],
  },
  {
    id: 'career',
    label: 'Career & Work',
    emoji: '💼',
    keywords: [
      'job', 'jobs', 'career', 'boss', 'interview', 'interviews', 'resume',
      'promotion', 'quit', 'fired', 'unemployment', 'office', 'coworkers',
      'parking', 'nurse', 'shift', 'workday', 'workplace',
    ],
  },
  {
    id: 'relationships',
    label: 'Relationships',
    emoji: '💌',
    keywords: [
      'relationship', 'relationships', 'girlfriend', 'boyfriend', 'partner',
      'marriage', 'married', 'breakup', 'dating', 'distance', 'spouse',
      'husband', 'wife', 'love', 'letter', 'letters', 'calls',
    ],
  },
  {
    id: 'family',
    label: 'Family & Home',
    emoji: '🏡',
    keywords: [
      'family', 'parents', 'mom', 'dad', 'mother', 'father', 'brother',
      'sister', 'grandma', 'grandpa', 'son', 'daughter', 'home', 'proud',
    ],
  },
  {
    id: 'loneliness',
    label: 'Loneliness & Connection',
    emoji: '🫂',
    keywords: [
      'lonely', 'loneliness', 'alone', 'isolated', 'isolation', 'invisible',
      'disconnected', 'friendless', 'nobody', 'friends', 'friendship',
    ],
  },
  {
    id: 'sleep',
    label: 'Sleep & Restless Nights',
    emoji: '🌙',
    keywords: [
      'sleep', 'sleeping', 'asleep', 'insomnia', 'sleepless', 'awake', 'night',
      'nights', 'midnight', 'bedtime', 'nap', 'dreams',
    ],
  },
  {
    id: 'self_esteem',
    label: 'Confidence & Self-worth',
    emoji: '🌱',
    keywords: [
      'confidence', 'confident', 'esteem', 'worth', 'imposter', 'insecure',
      'insecurity', 'doubt', 'comparing', 'comparison', 'enough', 'fail',
      'failure', 'failing', 'mistake', 'growth', 'growing', 'boundaries',
    ],
  },
  {
    id: 'habits',
    label: 'Habits & Routines',
    emoji: '✅',
    keywords: [
      'habit', 'habits', 'routine', 'routines', 'discipline', 'consistency',
      'consistent', 'journal', 'journaling', 'journal', 'meditation',
      'meditate', 'mindfulness', 'streak', 'daily', 'morning', 'bed',
      'improvement', 'improve', 'progress',
    ],
  },
  {
    id: 'gratitude',
    label: 'Gratitude & Joy',
    emoji: '✨',
    keywords: [
      'grateful', 'gratitude', 'thankful', 'grace', 'blessed', 'blessing',
      'appreciate', 'appreciation', 'joy', 'happy', 'happiness', 'win',
      'peaceful', 'peace', 'golden', 'beautiful', 'calm', 'cozy', 'warmth',
    ],
  },
  {
    id: 'recovery',
    label: 'Recovery & Healing',
    emoji: '💪',
    keywords: [
      'recovery', 'recovering', 'sober', 'sobriety', 'relapse', 'addiction',
      'addict', 'alcoholic', 'healing', 'heal', 'healing', 'stronger',
      'survivor', 'sober', 'days', 'rep', 'fighting',
    ],
  },
  {
    id: 'grief',
    label: 'Grief & Loss',
    emoji: '🕊️',
    keywords: [
      'grief', 'grieving', 'loss', 'loss', 'passed', 'died', 'death', 'mourning',
      'miss', 'missing', 'funeral', 'memoriam', 'guitar', 'song', 'fragile',
    ],
  },
  {
    id: 'fitness',
    label: 'Movement & Fitness',
    emoji: '🏃',
    keywords: [
      'run', 'running', 'ran', 'gym', 'workout', 'exercise', 'fitness', 'yoga',
      'walk', 'walking', 'walked', 'mile', 'miles', 'studio', 'practice',
      'practiced', 'stretching', 'health',
    ],
  },
  {
    id: 'creativity',
    label: 'Creativity & Expression',
    emoji: '🎨',
    keywords: [
      'music', 'song', 'song', 'guitar', 'art', 'painting', 'paint', 'writing',
      'write', 'wrote', 'poetry', 'poem', 'creative', 'photography', 'photo',
      'camera', 'draw', 'drawing', 'vlog', 'unedited',
    ],
  },
  {
    id: 'self_care',
    label: 'Self-care & Rest',
    emoji: '🛁',
    keywords: [
      'rest', 'resting', 'selfcare', 'care', 'permission', 'tea', 'slow',
      'slowing', 'quiet', 'gentle', 'softer', 'kindness', 'reset', 'sunday',
      'window', 'small',
    ],
  },
];

export const PROBLEM_IDS = PROBLEMS.map((p) => p.id);

const BY_ID = new Map(PROBLEMS.map((p) => [p.id, p]));

export function getProblem(id: string): ProblemCategory | undefined {
  return BY_ID.get(id);
}

/**
 * Deterministic mapping from the free-form topic picker to problem
 * categories. Topic strings are the ones offered in the composer
 * (lib/data/sample TOPICS) plus a few aliases.
 */
export const TOPIC_TO_PROBLEMS: Record<string, [string, number][]> = {
  'Mental Health': [['mood', 0.45], ['anxiety', 0.3], ['self_care', 0.25]],
  'Life': [['self_care', 0.5], ['gratitude', 0.5]],
  'Relationships': [['relationships', 0.8], ['family', 0.2]],
  'Studying': [['studying', 1]],
  'Career': [['career', 1]],
  'Gratitude': [['gratitude', 1]],
  'Fitness': [['fitness', 1]],
  'Creativity': [['creativity', 1]],
  'Recovery': [['recovery', 1]],
  'Self Improvement': [['habits', 0.6], ['self_esteem', 0.4]],
};
