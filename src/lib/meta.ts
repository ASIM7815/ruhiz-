import {
  Activity,
  BookOpen,
  Briefcase,
  Brain,
  Building,
  CircleCheckBig,
  CircleDot,
  CircleQuestionMark,
  Construction,
  Cpu,
  FileSearch,
  GitCompareArrows,
  GraduationCap,
  HandCoins,
  HandHelping,
  Heart,
  HeartHandshake,
  Backpack,
  Landmark,
  Leaf,
  Lightbulb,
  MapPin,
  MessageSquareQuote,
  MessagesSquare,
  Microscope,
  Package,
  Sparkles,
  Sprout,
  UserRound,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CategoryId, ContributionType, HelpType, ProblemStatus, SolutionStage } from "./types";

/** Tone classes are static strings so Tailwind can see them. */
export interface Tone {
  pill: string; // background + text + border for small badges
  text: string;
  dot: string;
  bar: string; // left accent border colour
}

const tone = (pill: string, text: string, dot: string, bar: string): Tone => ({ pill, text, dot, bar });

export const TONES = {
  red: tone("bg-rose-500/12 text-rose-300 border-rose-400/25", "text-rose-300", "bg-rose-400", "border-l-rose-400"),
  blue: tone("bg-blue-500/12 text-blue-300 border-blue-400/25", "text-blue-300", "bg-blue-400", "border-l-blue-400"),
  indigo: tone("bg-indigo-500/12 text-indigo-300 border-indigo-400/25", "text-indigo-300", "bg-indigo-400", "border-l-indigo-400"),
  amber: tone("bg-amber-500/12 text-amber-300 border-amber-400/25", "text-amber-300", "bg-amber-400", "border-l-amber-400"),
  pink: tone("bg-pink-500/12 text-pink-300 border-pink-400/25", "text-pink-300", "bg-pink-400", "border-l-pink-400"),
  orange: tone("bg-orange-500/12 text-orange-300 border-orange-400/25", "text-orange-300", "bg-orange-400", "border-l-orange-400"),
  cyan: tone("bg-cyan-500/12 text-cyan-300 border-cyan-400/25", "text-cyan-300", "bg-cyan-400", "border-l-cyan-400"),
  emerald: tone("bg-emerald-500/12 text-emerald-300 border-emerald-400/25", "text-emerald-300", "bg-emerald-400", "border-l-emerald-400"),
  violet: tone("bg-violet-500/12 text-violet-300 border-violet-400/25", "text-violet-300", "bg-violet-400", "border-l-violet-400"),
  teal: tone("bg-teal-500/12 text-teal-300 border-teal-400/25", "text-teal-300", "bg-teal-400", "border-l-teal-400"),
  sky: tone("bg-sky-500/12 text-sky-300 border-sky-400/25", "text-sky-300", "bg-sky-400", "border-l-sky-400"),
  lime: tone("bg-lime-500/12 text-lime-300 border-lime-400/25", "text-lime-300", "bg-lime-400", "border-l-lime-400"),
  slate: tone("bg-slate-400/12 text-slate-300 border-slate-400/25", "text-slate-300", "bg-slate-400", "border-l-slate-400"),
} satisfies Record<string, Tone>;

export const CATEGORIES: Record<CategoryId, { label: string; icon: LucideIcon; tone: Tone; posts: number; blurb: string }> = {
  // === NEW ENGINEERING-FOCUSED CATEGORIES (Primary) ===
  "coding-help": { label: "Coding & DSA", icon: Cpu, tone: TONES.cyan, posts: 15200, blurb: "Algorithm doubts, debugging, competitive programming" },
  "project-help": { label: "Project Help", icon: Construction, tone: TONES.blue, posts: 8900, blurb: "Building, debugging, architecture advice" },
  "placement-prep": { label: "Placement Prep", icon: Briefcase, tone: TONES.amber, posts: 12400, blurb: "Interviews, aptitude, resume, company experiences" },
  "exam-strategies": { label: "Exam Strategies", icon: GraduationCap, tone: TONES.violet, posts: 9500, blurb: "Study techniques, subject help, time management" },
  "hackathons": { label: "Hackathons & Competitions", icon: Sparkles, tone: TONES.pink, posts: 4200, blurb: "Team formation, project ideas, submission help" },
  "campus-life": { label: "Campus Life", icon: Backpack, tone: TONES.indigo, posts: 7300, blurb: "Hostel, events, clubs, campus experiences" },
  "career-guidance": { label: "Career Guidance", icon: Landmark, tone: TONES.orange, posts: 6800, blurb: "Internships, skill development, industry insights" },
  "mental-wellness": { label: "Mental Wellness", icon: Brain, tone: TONES.red, posts: 5600, blurb: "Exam stress, imposter syndrome, burnout" },
  "research-papers": { label: "Research & Publications", icon: Microscope, tone: TONES.teal, posts: 3100, blurb: "Paper writing, conferences, academic projects" },
  "tech-exploration": { label: "Tech Exploration", icon: BookOpen, tone: TONES.sky, posts: 5900, blurb: "New technologies, learning paths, tool recommendations" },
  "entrepreneurship": { label: "Entrepreneurship", icon: Package, tone: TONES.emerald, posts: 2800, blurb: "Startup ideas, funding, building products" },
  "lab-practical": { label: "Labs & Practicals", icon: Activity, tone: TONES.lime, posts: 4400, blurb: "Equipment, experiments, safety, report writing" },
  "student-life": { label: "Student Life", icon: Users, tone: TONES.slate, posts: 3900, blurb: "Relationships, family, personal challenges" },
  
  // === OLD CATEGORIES (Deprecated - kept for backward compatibility) ===
  // These map to new categories or remain for existing database content
  "mental-health": { label: "Mental Health", icon: Brain, tone: TONES.red, posts: 12400, blurb: "Anxiety, burnout, loneliness and recovery stories" },
  "education": { label: "Education", icon: GraduationCap, tone: TONES.blue, posts: 8700, blurb: "Access to learning, resources, exams and teaching" },
  "career": { label: "Career & Jobs", icon: Briefcase, tone: TONES.amber, posts: 5800, blurb: "Layoffs, job search, workplace challenges" },
  "relationships": { label: "Relationships", icon: Heart, tone: TONES.pink, posts: 6100, blurb: "Partners, friendships, boundaries" },
  "family": { label: "Family", icon: Users, tone: TONES.orange, posts: 3900, blurb: "Caregiving, parenting and family conflict" },
  "technology": { label: "Technology", icon: Cpu, tone: TONES.cyan, posts: 3400, blurb: "Digital access, tools and tech problems" },
  "environment": { label: "Environment", icon: Leaf, tone: TONES.emerald, posts: 2800, blurb: "Waste, water, climate and local ecology" },
  "community": { label: "Community", icon: HandHelping, tone: TONES.violet, posts: 4700, blurb: "Neighbourhood issues and collective action" },
  "finance": { label: "Finance", icon: Wallet, tone: TONES.teal, posts: 3100, blurb: "Debt, budgeting and financial stress" },
  "health": { label: "Health", icon: Activity, tone: TONES.sky, posts: 2600, blurb: "Access to care, caregiving and wellbeing" },
  "self-improvement": { label: "Self Improvement", icon: Sprout, tone: TONES.lime, posts: 4900, blurb: "Habits, discipline and personal growth" },
  "infrastructure": { label: "Infrastructure", icon: Building, tone: TONES.slate, posts: 1900, blurb: "Water, roads, power and public services" },
};

export const CONTRIBUTION_TYPES: Record<ContributionType, { label: string; short: string; icon: LucideIcon; tone: Tone; hint: string }> = {
  experience: { label: "Personal Experience", short: "Experience", icon: UserRound, tone: TONES.violet, hint: "Something you lived through that relates to this." },
  evidence: { label: "Evidence", short: "Evidence", icon: FileSearch, tone: TONES.emerald, hint: "Data, sources, photos or verifiable facts." },
  opinion: { label: "Opinion", short: "Opinion", icon: MessageSquareQuote, tone: TONES.sky, hint: "Your view on the cause or what should happen." },
  counter: { label: "Counterargument", short: "Counter", icon: GitCompareArrows, tone: TONES.amber, hint: "A respectful challenge to a point made above." },
  question: { label: "Question", short: "Question", icon: CircleQuestionMark, tone: TONES.cyan, hint: "Ask for detail that would help everyone understand." },
  solution: { label: "Proposed Solution", short: "Solution", icon: Lightbulb, tone: TONES.blue, hint: "A concrete approach someone could act on." },
  support: { label: "Emotional Support", short: "Support", icon: HeartHandshake, tone: TONES.red, hint: "Kind words for the person behind the post." },
};

export const HELP_TYPES: Record<HelpType, { label: string; icon: LucideIcon; desc: string }> = {
  knowledge: { label: "Knowledge", icon: BookOpen, desc: "I understand this topic and can explain or guide." },
  technical: { label: "Technical Expertise", icon: Wrench, desc: "I can design, build, repair or engineer." },
  research: { label: "Research", icon: Microscope, desc: "I can gather data, surveys or evidence." },
  funding: { label: "Funding", icon: HandCoins, desc: "I can contribute money or help raise it." },
  equipment: { label: "Equipment", icon: Package, desc: "I have materials, tools or space to lend." },
  volunteering: { label: "Volunteering", icon: HandHelping, desc: "I can give time on the ground." },
  local: { label: "Local Connection", icon: MapPin, desc: "I know people or offices in this area." },
  professional: { label: "Professional Service", icon: Briefcase, desc: "I offer a relevant professional service." },
  organization: { label: "Organization", icon: Landmark, desc: "My NGO, company or institution can step in." },
  other: { label: "Other", icon: Sparkles, desc: "Something else that could move this forward." },
};

export const STATUS_ORDER: ProblemStatus[] = ["unsolved", "discussion", "solutions", "implementation", "solved"];

export const STATUS_META: Record<ProblemStatus, { label: string; icon: LucideIcon; tone: Tone; desc: string }> = {
  unsolved: { label: "Unsolved", icon: CircleDot, tone: TONES.red, desc: "Raised and waiting for people who understand it." },
  discussion: { label: "In Discussion", icon: MessagesSquare, tone: TONES.amber, desc: "People are sharing experiences and evidence." },
  solutions: { label: "Solutions Proposed", icon: Lightbulb, tone: TONES.blue, desc: "Concrete approaches are on the table." },
  implementation: { label: "Implementing", icon: Construction, tone: TONES.violet, desc: "Contributors are putting a solution into action." },
  solved: { label: "Solved", icon: CircleCheckBig, tone: TONES.emerald, desc: "An outcome has been reached and documented." },
};

export const STAGE_ORDER: SolutionStage[] = ["proposed", "reviewing", "funding", "implementing", "completed"];

export const STAGE_META: Record<SolutionStage, { label: string; tone: Tone }> = {
  proposed: { label: "Proposed", tone: TONES.sky },
  reviewing: { label: "Community Review", tone: TONES.amber },
  funding: { label: "Gathering Resources", tone: TONES.teal },
  implementing: { label: "Implementing", tone: TONES.violet },
  completed: { label: "Completed", tone: TONES.emerald },
};

export const INTENT_LABEL: Record<string, string> = {
  problem: "Problem",
  experience: "Experience",
  thought: "Thought",
  solution: "Solution",
  support: "Seeking support",
  update: "Progress update",
};

export const TRENDING_TOPICS: { label: string; category: CategoryId; count: number }[] = [
  { label: "Coding & DSA", category: "coding-help", count: 15200 },
  { label: "Placement Prep", category: "placement-prep", count: 12400 },
  { label: "Exam Strategies", category: "exam-strategies", count: 9500 },
  { label: "Project Help", category: "project-help", count: 8900 },
  { label: "Campus Life", category: "campus-life", count: 7300 },
  { label: "Career Guidance", category: "career-guidance", count: 6800 },
  { label: "Tech Exploration", category: "tech-exploration", count: 5900 },
  { label: "Mental Wellness", category: "mental-wellness", count: 5600 },
];

export const SUPPORT_AREAS = [
  "Exam stress",
  "Placement anxiety",
  "Coding challenges",
  "Project guidance",
  "Imposter syndrome",
  "Burnout",
  "Career confusion",
  "Interview prep",
  "Study strategies",
  "Time management",
  "Peer pressure",
  "Academic struggles",
];
