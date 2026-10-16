"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Building2, CheckCircle2, Clock, FolderKanban, Users } from "lucide-react";

const STATS = [
  { 
    icon: Users, 
    value: 15000, 
    suffix: "+", 
    label: "Engineering Students",
    color: "text-cyan-400",
    desc: "Across IITs, NITs, and 120+ colleges"
  },
  { 
    icon: CheckCircle2, 
    value: 45000, 
    suffix: "+", 
    label: "Problems Solved",
    color: "text-emerald-400",
    desc: "Real solutions, not just discussions"
  },
  { 
    icon: Building2, 
    value: 120, 
    suffix: "+", 
    label: "Colleges Represented",
    color: "text-violet-400",
    desc: "A truly diverse community"
  },
  { 
    icon: FolderKanban, 
    value: 2500, 
    suffix: "+", 
    label: "Projects Showcased",
    color: "text-amber-400",
    desc: "Student portfolios that impress"
  },
  { 
    icon: Award, 
    value: 85, 
    suffix: "%", 
    label: "Placement Success Rate",
    color: "text-rose-400",
    desc: "Among active community members"
  },
  { 
    icon: Clock, 
    value: 24, 
    suffix: "/7", 
    label: "Peer Support",
    color: "text-sky-400",
    desc: "Someone's always online to help"
  },
];

/**
 * Animated counter hook - counts from 0 to target value
 */
function useCounter(target: number, isVisible: boolean, duration: number = 2000) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!isVisible) return;
    
    const startTime = Date.now();
    const endTime = startTime + duration;
    
    const updateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(easeOutQuart * target);
      
      setCount(current);
      
      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(target);
      }
    };
    
    requestAnimationFrame(updateCount);
  }, [target, isVisible, duration]);
  
  return count;
}

/**
 * Individual stat card with animated counter
 */
function StatCard({ stat, index, isVisible }: { stat: typeof STATS[0]; index: number; isVisible: boolean }) {
  const Icon = stat.icon;
  const count = useCounter(stat.value, isVisible, 2000 + index * 100);
  
  return (
    <div 
      className="group relative overflow-hidden rounded-2xl border border-[var(--l-line)] bg-black/40 p-6 backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-[var(--l-line)]/60"
      style={{ 
        animationDelay: `${index * 0.1}s`,
        ["--reveal-delay" as string]: `${index * 0.1}s` 
      }}
    >
      {/* Glow effect on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${stat.color.replace('text-', 'from-')}/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100`} />
      
      <div className="relative z-10">
        <div className={`mb-4 inline-flex rounded-xl bg-black/60 p-3 ${stat.color}`}>
          <Icon className="size-6" />
        </div>
        
        <div className="mb-2 flex items-baseline gap-1">
          <span className="font-mono text-4xl font-bold text-white" aria-live="polite">
            {count.toLocaleString()}
          </span>
          <span className={`text-2xl font-bold ${stat.color}`}>{stat.suffix}</span>
        </div>
        
        <h3 className="mb-1 text-lg font-semibold text-white">{stat.label}</h3>
        <p className="text-sm text-[var(--l-muted)]">{stat.desc}</p>
      </div>
    </div>
  );
}

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  useEffect(() => {
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    
    if (prefersReducedMotion) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      {
        threshold: 0.2,
        rootMargin: "0px 0px -100px 0px"
      }
    );
    
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    
    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [hasAnimated]);
  
  return (
    <section 
      ref={sectionRef}
      id="stats" 
      className="l-section relative overflow-hidden" 
      aria-labelledby="stats-title"
    >
      {/* Background with subtle pattern */}
      <div className="absolute inset-0 opacity-30" aria-hidden>
        <div className="l-blob absolute left-1/4 top-1/4 size-96 bg-cyan-500/20 blur-3xl" />
        <div className="l-blob absolute bottom-1/4 right-1/4 size-96 bg-violet-500/20 blur-3xl" />
      </div>
      
      <div className="l-wrap relative z-10">
        <div className="text-center">
          <span className="l-eyebrow" data-reveal><i /> Community Impact</span>
          <h2 id="stats-title" className="l-h2 l-display mx-auto mt-5 max-w-3xl" data-reveal>
            Growing stronger, <span className="l-grad">one engineer at a time</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--l-ink2)]" data-reveal>
            Real numbers from a real community solving real problems. And we're just getting started.
          </p>
        </div>
        
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} isVisible={isVisible} />
          ))}
        </div>
        
        <div className="mt-12 text-center" data-reveal>
          <p className="text-[var(--l-muted)]">
            Join thousands of engineering students who've found their community.
          </p>
        </div>
      </div>
    </section>
  );
}
