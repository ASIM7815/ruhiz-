# Ruhiz - Real People. Brighter Tomorrows.

A safe and supportive community website built with Next.js, designed pixel-perfectly from reference images.

## Features

- **Responsive Design**: Fully responsive layout that works on desktop, tablet, and mobile
- **Modern Stack**: Built with Next.js 15, React 19, TypeScript, and Tailwind CSS
- **Component-Based**: Clean, reusable components for maintainability
- **Pixel-Perfect**: Matches the reference design specifications exactly
- **Performance Optimized**: Next.js Image optimization and code splitting

## Production

Ruhiz now ships a deterministic recommendation engine, Supabase Realtime chat,
and production media uploads (private Cloudflare R2 + presigned URLs), with
**Support** as the community reaction model.

- **SQL migration (run once, idempotent, nothing else required):**
  `supabase/migrations/20260913000000_ruhiz_production.sql`
- **Setup guide, algorithm details and R2 CORS config:** see `PRODUCTION_READY.md`
- **Environment variables:** see `.env.example`

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
ruhiz/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage
│   └── globals.css         # Global styles
├── components/
│   ├── Header.tsx          # Navigation header
│   ├── Hero.tsx            # Hero section
│   ├── Features.tsx        # Features grid
│   ├── Stats.tsx           # Statistics section
│   ├── Stories.tsx         # Testimonials carousel
│   ├── FinalCTA.tsx        # Call-to-action section
│   └── Footer.tsx          # Footer
├── public/
│   └── images/             # Image assets
└── README.md
```

## Build for Production

```bash
npm run build
npm start
```

## Technologies Used

- **Next.js 15** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **Playfair Display & Inter** - Typography
- **Caveat** - Handwritten text style

## Design Specifications

### Colors
- Primary Teal: `#2D5F5D`
- Light Teal: `#E8F4F3`
- Background: White and soft pastels

### Typography
- Headings: Playfair Display (serif)
- Body: Inter (sans-serif)
- Handwritten notes: Caveat (cursive)

## License

© 2024 Ruhiz. All rights reserved.
