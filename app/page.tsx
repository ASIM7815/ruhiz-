import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/ui/Icons';
import { SEED_CATEGORIES, SEED_CHALLENGES } from '@/lib/duel/seed';

export default function LandingPage() {
  const featured = SEED_CHALLENGES.slice(0, 6);
  const totalChallengers = SEED_CHALLENGES.reduce((s, c) => s + c.participantCount, 0);
  const totalCompletions = SEED_CHALLENGES.reduce((s, c) => s + c.completionCount, 0);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-black/85 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
          <Image src="/images/duel-logo.png" alt="DUEL — Challenge A Better You" width={1441} height={373} style={{ height: 26, width: 'auto' }} priority />
          <nav className="hidden md:flex items-center gap-6 ml-auto text-sm text-white/70">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#categories" className="hover:text-white transition-colors">Categories</a>
            <a href="#featured" className="hover:text-white transition-colors">Featured</a>
          </nav>
          <div className="flex items-center gap-3 ml-auto md:ml-0">
            <Link href="/login" className="text-sm font-semibold text-white/80 hover:text-white transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-bold bg-[#16e08a] text-black px-4 py-2 rounded-xl hover:bg-[#0dbb72] transition-colors">
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-[#16e08a]/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-5 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center relative">
          <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#16e08a]/40 bg-[#16e08a]/10 text-[#16e08a] text-xs font-bold uppercase tracking-[0.18em] mb-7">
            <Icon name="bolt" size={13} /> The social platform for personal challenges
          </p>
          <h1 className="display text-5xl sm:text-7xl leading-[0.95]">
            Challenge
            <br />
            a better <span className="text-[#16e08a]">you.</span>
          </h1>
          <p className="max-w-xl mx-auto mt-6 text-white/60 text-base sm:text-lg leading-relaxed">
            Create, join and complete personal challenges — 30 Days Coding, 21 Days Fitness, 7 Days No Social Media.
            Check in daily, protect your streak, and let the community hold you to it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-9">
            <Link href="/signup" className="px-7 py-3.5 rounded-xl bg-[#16e08a] text-black font-bold hover:bg-[#0dbb72] transition-colors flex items-center justify-center gap-2">
              <Icon name="swords" size={17} /> Start your first duel
            </Link>
            <Link href="/login" className="px-7 py-3.5 rounded-xl border border-white/20 font-semibold hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
              <Icon name="explore" size={17} /> Explore challenges
            </Link>
          </div>

          <dl className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-14">
            <HeroStat value={`${SEED_CATEGORIES.length}`} label="Categories" />
            <HeroStat value={`${Math.round(totalChallengers / 1000)}K+`} label="Challengers" />
            <HeroStat value={`${Math.round(totalCompletions / 1000)}K+`} label="Duels won" />
          </dl>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/10 bg-[#08090b]">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h2 className="display text-3xl sm:text-4xl text-center">Three moves. Every day.</h2>
          <p className="text-center text-white/50 mt-3 max-w-md mx-auto text-sm">DUEL turns ambition into a daily score you can see.</p>
          <div className="grid md:grid-cols-3 gap-5 mt-12">
            <Step n="01" icon="swords" title="Create or join" text="Pick from community challenges or write your own rules: category, duration, difficulty and the daily task that counts as a win." />
            <Step n="02" icon="check" title="Check in daily" text="One tap logs the day. Streaks count consecutive check-ins — miss a day and the chain resets, exactly like it should." />
            <Step n="03" icon="trophy" title="Finish & flex" text="Complete every day to win the duel: trophy on your profile, completion on the leaderboard, and a record that never lies." />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="display text-3xl">Pick your arena</h2>
              <p className="text-white/50 mt-2 text-sm">Ten categories, one rule: show up daily.</p>
            </div>
            <Link href="/signup" className="text-sm font-bold text-[#16e08a] hover:underline flex-shrink-0">Browse all →</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SEED_CATEGORIES.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-[#16e08a]/40 transition-colors">
                <span className="text-2xl">{c.emoji}</span>
                <p className="font-bold text-sm mt-2 leading-snug">{c.name}</p>
                <p className="text-[11px] text-white/45 mt-1 leading-snug">{c.tagline}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured challenges */}
      <section id="featured" className="border-t border-white/10 bg-[#08090b]">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h2 className="display text-3xl mb-8">Duels running right now</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((c) => {
              const cat = SEED_CATEGORIES.find((x) => x.id === c.categoryId);
              return (
                <Link key={c.id} href="/signup" className="group rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-[#16e08a]/40 transition-colors">
                  <div className="h-32 relative" style={{ background: `radial-gradient(120% 120% at 15% 0%, ${cat?.color}44 0%, ${cat?.color}12 45%, transparent 70%), #0b0f13` }}>
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-[11px] font-semibold">{cat?.emoji} {cat?.name}</span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#16e08a] text-black text-[11px] font-bold display">{c.durationDays} Days</span>
                    <span className="absolute bottom-3 left-3 text-3xl">{cat?.emoji}</span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-[15px] group-hover:text-[#16e08a] transition-colors">{c.title}</h3>
                    <p className="text-xs text-white/50 mt-1.5 line-clamp-2 leading-relaxed">{c.description}</p>
                    <p className="text-[11px] text-white/40 mt-3 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Icon name="people" size={12} /> {c.participantCount.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Icon name="heart" size={12} /> {c.likeCount.toLocaleString()}</span>
                      <span className="flex items-center gap-1"><Icon name="trophy" size={12} /> {c.completionCount.toLocaleString()}</span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10">
        <div className="max-w-4xl mx-auto px-5 py-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(22,224,138,0.12),transparent_70%)]" />
          <h2 className="display text-4xl sm:text-5xl relative">Tomorrow’s you is watching.</h2>
          <p className="text-white/55 mt-4 max-w-md mx-auto text-sm relative">
            Every streak starts with one unglamorous check-in. Make today’s count.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 mt-8 px-8 py-4 rounded-xl bg-[#16e08a] text-black font-bold hover:bg-[#0dbb72] transition-colors relative">
            <Icon name="bolt" size={17} /> Create free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <Image src="/images/duel-logo.png" alt="DUEL" width={1441} height={373} style={{ height: 22, width: 'auto' }} />
          <p className="text-[11px] text-white/40">© 2026 DUEL · Challenge A Better You · Built for daily winners</p>
          <div className="flex gap-5 text-xs text-white/50">
            <Link href="/login" className="hover:text-white">Sign in</Link>
            <Link href="/signup" className="hover:text-white">Sign up</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="display text-3xl text-[#16e08a]">{value}</dt>
      <dd className="text-[11px] uppercase tracking-[0.18em] text-white/45 mt-1">{label}</dd>
    </div>
  );
}

function Step({ n, icon, title, text }: { n: string; icon: string; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 relative overflow-hidden">
      <span className="display text-5xl text-white/8 absolute top-4 right-5">{n}</span>
      <span className="w-11 h-11 rounded-2xl bg-[#16e08a]/15 text-[#16e08a] flex items-center justify-center mb-4">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="font-bold text-lg">{title}</h3>
      <p className="text-sm text-white/55 mt-2 leading-relaxed">{text}</p>
    </div>
  );
}
