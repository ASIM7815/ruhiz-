import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import Stats from '@/components/Stats'
import Stories from '@/components/Stories'
import FinalCTA from '@/components/FinalCTA'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Header />
      <Hero />
      <Features />
      <Stats />
      <Stories />
      <FinalCTA />
      <Footer />
    </main>
  )
}
