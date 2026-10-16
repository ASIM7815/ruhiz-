"use client";

import { useState } from "react";
import { Bookmark, Code, FileText, Heart, MessageCircle, Play, ShieldCheck, Trophy } from "lucide-react";

type PostType = "problem" | "experience" | "project" | "question";

const TABS: { id: PostType; label: string }[] = [
  { id: "problem", label: "Problem" },
  { id: "experience", label: "Experience" },
  { id: "project", label: "Project" },
  { id: "question", label: "Question" },
];

const POSTS: Record<PostType, {
  title: string;
  body: string;
  category: string;
  author: string;
  authorDesc: string;
  tags: string[];
  metrics: { supports: number; discussions: number; };
  hasCode?: boolean;
  hasProject?: boolean;
  replies: { type: string; color: string; text: string }[];
}> = {
  problem: {
    title: "Getting TLE in Leetcode Medium - need optimization help",
    body: "I'm solving 'Longest Substring Without Repeating Characters' and getting Time Limit Exceeded. Tried two approaches - both are O(n²). I think I need sliding window but can't figure out the implementation. Has anyone solved this? Can share approach?",
    category: "Coding & DSA",
    author: "#K4M2N7",
    authorDesc: "Identity Saver · 3rd year CSE",
    tags: ["DSA", "LeetCode", "Sliding Window"],
    metrics: { supports: 5, discussions: 12 },
    hasCode: true,
    replies: [
      { type: "Experience", color: "#a78bfa", text: "I struggled with this exact problem! The key is maintaining a HashSet while moving the window. Took me 3 tries to get it right." },
      { type: "Solution", color: "#60a5fa", text: "Use two pointers with a HashMap to track character positions. Here's my accepted solution with O(n) complexity..." },
      { type: "Question", color: "#22d3ee", text: "Are you handling the edge case where all characters are unique?" },
    ]
  },
  experience: {
    title: "How I cracked Microsoft in 4th attempt - complete roadmap",
    body: "After 3 rejections from Microsoft, I finally got the offer in my 4th attempt. Sharing my entire preparation journey: what worked, what didn't, and the exact timeline. Hope this helps someone in the same boat I was in.",
    category: "Placement Prep",
    author: "Rahul Verma",
    authorDesc: "B.Tech CSE, NIT Trichy · Placed @ Microsoft",
    tags: ["Microsoft", "Interview", "DSA", "System Design"],
    metrics: { supports: 127, discussions: 45 },
    replies: [
      { type: "Question", color: "#22d3ee", text: "How much time did you spend on system design vs DSA?" },
      { type: "Experience", color: "#a78bfa", text: "Your story resonates so much! I'm on my 2nd attempt with Amazon. Did you change your approach between attempts?" },
      { type: "Opinion", color: "#fbbf24", text: "Persistence like this is what separates those who make it from those who give up. Inspiring post!" },
    ]
  },
  project: {
    title: "Built an AI-powered attendance system using face recognition",
    body: "Created a real-time face recognition attendance system for our college. Uses OpenCV + Python + Firebase. 99.2% accuracy in testing. Demoed to admin - they're interested! Looking for feedback before I polish it for hackathons.",
    category: "Project Help",
    author: "Priya Sharma",
    authorDesc: "B.Tech ECE, IIIT Hyderabad",
    tags: ["AI/ML", "OpenCV", "Python", "Firebase"],
    metrics: { supports: 34, discussions: 18 },
    hasProject: true,
    replies: [
      { type: "Question", color: "#22d3ee", text: "What dataset did you use for training? Did you handle multiple lighting conditions?" },
      { type: "Evidence", color: "#34d399", text: "Impressive accuracy! For production, consider adding liveness detection to prevent photo spoofing." },
      { type: "Opinion", color: "#fbbf24", text: "This would be perfect for Smart India Hackathon. Have you considered adding a mobile app interface?" },
    ]
  },
  question: {
    title: "Which is better for placements: DSA mastery or project building?",
    body: "I'm in 3rd year and confused about where to invest my time. Everyone says DSA is king for FAANG, but recruiters also ask about projects. I have time for only one - which should I prioritize? What did you focus on and did it work?",
    category: "Career Guidance",
    author: "#P9Q5R2",
    authorDesc: "Identity Saver · 3rd year ME",
    tags: ["Career", "DSA", "Projects", "Placements"],
    metrics: { supports: 23, discussions: 67 },
    replies: [
      { type: "Experience", color: "#a78bfa", text: "I focused 70% on DSA and 30% on projects. Got through to Google. DSA clears interviews, projects give you talking points." },
      { type: "Counter", color: "#fbbf24", text: "Disagree slightly - depends on the company. Startups care more about projects. FAANG cares more about DSA. Target accordingly." },
      { type: "Evidence", color: "#34d399", text: "According to placement stats from our college, students with strong DSA + 1-2 solid projects have 85% placement rate in dream companies." },
    ]
  },
};

function CodeSnippet() {
  return (
    <div className="mt-3 rounded-lg border border-[var(--l-line)] bg-black/60 p-3 font-mono text-[0.75rem]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[var(--l-muted)]">Python</span>
        <Code className="size-3.5 text-cyan-400" />
      </div>
      <code className="block text-cyan-300">
        <span className="text-violet-400">def</span> <span className="text-amber-300">lengthOfLongest</span>(s):
        <br />
        &nbsp;&nbsp;<span className="text-slate-400"># O(n²) approach - TLE</span>
        <br />
        &nbsp;&nbsp;<span className="text-rose-400">...</span>
      </code>
    </div>
  );
}

function ProjectShowcase() {
  return (
    <div className="mt-3 rounded-lg border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-transparent p-3">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="size-4 text-amber-400" />
        <span className="text-[0.8rem] font-semibold text-white">Project Demo</span>
      </div>
      <div className="relative aspect-video overflow-hidden rounded-md bg-black/40">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20" />
        <Play className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 text-white/80" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <a href="#" className="text-[0.75rem] text-cyan-400 hover:underline">View on GitHub →</a>
        <span className="text-[0.7rem] text-[var(--l-muted)]">•</span>
        <span className="text-[0.75rem] text-[var(--l-muted)]">Demo video</span>
      </div>
    </div>
  );
}

export function Preview() {
  const [activePost, setActivePost] = useState<PostType>("problem");
  const post = POSTS[activePost];

  return (
    <section id="community" className="l-section" aria-labelledby="community-title">
      <div className="l-wrap">
        <div className="grid items-center gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="l-eyebrow" data-reveal><i /> Inside the platform</span>
            <h2 id="community-title" className="l-h2 l-display mt-5" data-reveal>
              Real posts from <span className="l-grad">real engineering students</span>.
            </h2>
            <p className="l-lead mt-5" data-reveal>
              From DSA struggles to placement victories, project showcases to career questions—see exactly what engineers are discussing, building, and solving together.
            </p>
            <div className="l-tabs mt-8" role="tablist" aria-label="Post types" data-reveal>
              {TABS.map((t) => (
                <button 
                  key={t.id} 
                  role="tab" 
                  id={`tab-${t.id}`} 
                  aria-selected={activePost === t.id} 
                  aria-controls="preview-panel" 
                  className="l-tab" 
                  onClick={() => setActivePost(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="l-frame" data-parallax="0.06" data-reveal>
            <div className="l-device">
              <div id="preview-panel" role="tabpanel" aria-labelledby={`tab-${activePost}`} className="l-glass l-post">
                {/* Post Header */}
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-sm font-bold text-white">
                    {post.author.startsWith("#") ? <ShieldCheck className="size-5" /> : post.author[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.92rem] font-semibold text-white">{post.author}</p>
                    <p className="text-[0.76rem] text-[var(--l-muted)]">{post.authorDesc}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-500/20 px-2.5 py-1 text-[0.7rem] font-medium text-blue-300">
                    {post.category}
                  </span>
                </div>

                {/* Post Content */}
                <h3 key={activePost} className="l-display l-id-enter mt-4 text-[1.2rem] font-bold leading-snug text-white">
                  {post.title}
                </h3>
                <p className="mt-1.5 text-[0.92rem] leading-relaxed text-[var(--l-ink2)]">
                  {post.body}
                </p>

                {/* Code Snippet for Problem Posts */}
                {post.hasCode && <CodeSnippet />}

                {/* Project Showcase for Project Posts */}
                {post.hasProject && <ProjectShowcase />}

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[0.7rem] text-[var(--l-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Engagement Metrics */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--l-line)] pt-3" aria-hidden>
                  <span className="l-act on">
                    <Heart className="size-4 text-[#ff6b9d]" /> {post.metrics.supports} Support
                  </span>
                  <span className="l-act">
                    <MessageCircle className="size-4" /> {post.metrics.discussions} Discuss
                  </span>
                  <span className="l-act ml-auto">
                    <Bookmark className="size-4" /> Save
                  </span>
                </div>

                {/* Replies */}
                <div className="mt-4 space-y-2">
                  <p className="text-[0.75rem] font-semibold uppercase tracking-wider text-[var(--l-muted)]">
                    {post.replies.length} Contributions
                  </p>
                  {post.replies.map((r, idx) => (
                    <div key={idx} className="l-reply" style={{ ["--tc" as string]: r.color }}>
                      <b>{r.type}</b>
                      {r.text}
                    </div>
                  ))}
                </div>

                {/* Example Indicator */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--l-line)] bg-black/20 px-3 py-2">
                  <FileText className="size-4 text-[var(--l-muted)]" />
                  <p className="text-[0.7rem] text-[var(--l-muted)]">
                    Example post illustration · Real content style from actual students
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
