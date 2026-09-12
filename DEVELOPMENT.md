# Ruhiz Development Guide

## Overview

This is the Ruhiz website frontend built with Next.js 15, designed pixel-perfectly from the provided reference images.

## Design Fidelity

The implementation follows the reference images exactly:

### Visual Elements
- ✅ Hero section with exact layout and image positioning
- ✅ Logo with leaf icon and tagline
- ✅ Navigation header with proper spacing
- ✅ Feature cards with icons and descriptions
- ✅ Statistics section with 4 metrics
- ✅ Testimonials carousel with navigation
- ✅ CTA sections with gradient backgrounds
- ✅ Footer with crisis support callout

### Typography
- **Headings**: Playfair Display (serif) - matches the elegant serif font in the designs
- **Body Text**: Inter (sans-serif) - clean, modern sans-serif
- **Handwritten Text**: Caveat (cursive) - for the handwritten notes like "You're not alone in this journey ♡"

### Colors
- **Primary Teal**: `#2D5F5D` - used for buttons and accents
- **Light Teal**: `#E8F4F3` - used for backgrounds
- **Pastels**: Soft pink/peach gradients in hero section
- **Neutral Grays**: For text hierarchy

### Spacing & Layout
- Maximum width container: 1280px (7xl)
- Consistent padding: 1.5rem (6 on Tailwind scale)
- Section spacing: 5rem vertical padding
- Proper responsive breakpoints: sm, md, lg, xl

## Component Structure

### Header (`components/Header.tsx`)
- Fixed position header with blur effect
- Logo with image and text
- Navigation links
- Login and Sign Up buttons

### Hero (`components/Hero.tsx`)
- Two-column layout (text left, image right)
- Large heading with Playfair Display
- Two CTA buttons
- User avatars with stats
- Hero image with handwritten overlays

### Features (`components/Features.tsx`)
- 5 feature cards in a grid
- Icon, title, and description for each
- Color-coded icon backgrounds

### Stats (`components/Stats.tsx`)
- 4 statistics with large numbers
- Dividers between stats
- Handwritten note overlay

### Stories (`components/Stories.tsx`)
- Carousel with 3 testimonials
- Navigation buttons
- Active state highlighting
- User avatars and quotes

### FinalCTA (`components/FinalCTA.tsx`)
- Full-width section with teal gradient
- Large heading and CTA button
- Handwritten note overlay

### Footer (`components/Footer.tsx`)
- 4-column grid layout
- Brand, links, support, crisis info
- Social media icons
- Bottom bar with copyright

## Running the Project

### Development Mode
```bash
npm run dev
```
Visit http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

### Type Checking
```bash
npx tsc --noEmit
```

## Responsive Behavior

The design adapts across screen sizes:

- **Mobile (< 768px)**: Single column layout, stacked sections
- **Tablet (768px - 1024px)**: Two-column grids where appropriate
- **Desktop (> 1024px)**: Full layout as shown in reference images

## Asset Management

All design assets are located in `public/images/`:
- `ruhizlogo-.png` - The Ruhiz logo with leaf icon
- `ruhizhero.png` - Hero section background image
- `ruhiz.png` - Full page reference design

## Next Steps

To extend this website:

1. **Add Routes**: Create pages for About, How It Works, Resources, Community
2. **Add Authentication**: Implement login/signup functionality
3. **Add Backend**: Connect to a CMS or database
4. **Add Animations**: Use Framer Motion for smooth transitions
5. **Add Forms**: Contact forms, community join forms
6. **SEO Optimization**: Add metadata, sitemap, robots.txt
7. **Analytics**: Add Google Analytics or similar

## Performance Considerations

- Images are optimized using Next.js Image component
- Fonts are preloaded via Google Fonts
- Static generation for fast loading
- Code splitting by route
- CSS is automatically purged in production

## Deployment

This Next.js app can be deployed to:

- **Vercel** (recommended, zero-config)
- **Netlify**
- **AWS Amplify**
- **Digital Ocean App Platform**
- **Any Node.js hosting**

```bash
# For Vercel
npm install -g vercel
vercel
```

## Maintenance

- Update dependencies regularly: `npm update`
- Check for security issues: `npm audit`
- Test on multiple devices and browsers
- Monitor Core Web Vitals
