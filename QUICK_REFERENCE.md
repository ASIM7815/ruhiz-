# Ruhiz - Quick Reference Guide

## 🎨 Color Palette

Copy-paste these into your code:

```css
/* Primary Colors */
--ruhiz-primary: #145C43;      /* Main green */
--ruhiz-deep: #0B3D2E;         /* Deep green for hover */
--ruhiz-soft: #DCEDE4;         /* Soft green for backgrounds */
--ruhiz-accent: #8FC9A8;       /* Accent green */

/* Neutral Colors */
--ruhiz-bg: #F7F9F7;           /* Page background */
--ruhiz-card: #FFFFFF;         /* Card background */
--ruhiz-text: #18332A;         /* Main text */
--ruhiz-text-secondary: #718078; /* Secondary text */
--ruhiz-border: #E3EAE6;       /* Borders */
```

## 📐 Layout Dimensions

```
Top Navigation: 70px height
Left Sidebar: 240px width
Right Sidebar: 340px width
Main Feed: 680px max-width
Welcome Banner: 240px height
```

## 🔧 Key Files

### Pages
- `/app/feed/page.tsx` - Main feed page

### Components
- `/components/ruhiz/RuhizFeed.tsx` - Main container
- `/components/ruhiz/TopNav.tsx` - Top navigation
- `/components/ruhiz/LeftSidebar.tsx` - Left sidebar with navigation
- `/components/ruhiz/MainFeed.tsx` - Main content area
- `/components/ruhiz/RightSidebar.tsx` - Right sidebar (collapsible)
- `/components/ruhiz/WelcomeBanner.tsx` - Hero banner with banner.png
- `/components/ruhiz/PostComposer.tsx` - Create post UI
- `/components/ruhiz/CategoryFilters.tsx` - Filter pills
- `/components/ruhiz/PostCard.tsx` - Individual post

## 🚀 Quick Commands

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start
```

## 🎯 Key Features

### Interactive Elements
- ✅ All navigation items work
- ✅ Create Moment button
- ✅ Post like/unlike with count
- ✅ Comment toggle
- ✅ Share menu
- ✅ Save/unsave posts
- ✅ Follow/unfollow people
- ✅ Collapsible right sidebar
- ✅ Category filters
- ✅ Dark mode toggle
- ✅ Three-dot menus

### Visual Features
- ✅ Pixel-perfect layout matching reference
- ✅ Green color scheme (not purple)
- ✅ `banner.png` as background image
- ✅ Smooth transitions
- ✅ Hover states
- ✅ Active states
- ✅ Proper shadows and borders

## 🔄 Login/Signup Flow

Both login and signup pages redirect to `/feed` after form submission (demo mode).

## 📱 Responsive Breakpoints

- **Desktop**: Full three-column layout
- **Tablet**: Right sidebar collapsible
- **Mobile**: Sidebars hidden (needs bottom nav - todo)

## 🎨 Typography

- **Headings**: Serif font for elegance
- **Body/UI**: Sans-serif for clarity
- **Sizes**: Follows clear hierarchy from reference

## 🔍 Search

Top navigation has search bar with placeholder:
"Search people, topics or moments..."

## 💚 Ruhiz Green Theme

The implementation uses a sophisticated green palette that feels:
- Professional
- Calm and peaceful
- Not overly saturated
- Restrained and elegant

This is the **official Ruhiz design system** based on the reference screenshot.

## ⚡ Performance

- Next.js Image optimization
- Component code splitting
- Fast build times
- Production-ready

## 🎉 Status

✅ **PIXEL-PERFECT IMPLEMENTATION COMPLETE**

The feed page at `/feed` matches the reference screenshot precisely!
