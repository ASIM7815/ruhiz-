# Ruhiz - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Open Browser
Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
ruhiz/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Homepage (main entry)
│   └── globals.css         # Global styles + Tailwind
│
├── components/
│   ├── Header.tsx          # Fixed navigation bar
│   ├── Hero.tsx            # Hero section with CTA
│   ├── Features.tsx        # 5 feature cards
│   ├── Stats.tsx           # Statistics section
│   ├── Stories.tsx         # Testimonials carousel
│   ├── FinalCTA.tsx        # Bottom call-to-action
│   └── Footer.tsx          # Footer with links
│
├── public/
│   └── images/
│       ├── ruhizlogo-.png  # Logo
│       ├── ruhizhero.png   # Hero background
│       └── ruhiz.png       # Full page reference
│
└── Configuration files
    ├── next.config.js      # Next.js config
    ├── tailwind.config.ts  # Tailwind CSS config
    ├── tsconfig.json       # TypeScript config
    └── package.json        # Dependencies
```

---

## 🎨 Design System

### Colors
| Color | Hex | Usage |
|-------|-----|-------|
| Ruhiz Teal | `#2D5F5D` | Primary buttons, accents |
| Light Teal | `#E8F4F3` | Backgrounds |
| Gray 900 | `#111827` | Headings |
| Gray 600 | `#4B5563` | Body text |

### Typography
| Element | Font | Weight |
|---------|------|--------|
| Headings | Playfair Display | 600-800 |
| Body | Inter | 400-600 |
| Handwritten | Caveat | 400-700 |

---

## 🛠️ Available Commands

```bash
# Development
npm run dev          # Start dev server on localhost:3000

# Production
npm run build        # Build optimized production bundle
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npx tsc --noEmit    # Type check without building
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Width | Tailwind Class |
|------------|-------|----------------|
| Mobile | < 768px | (default) |
| Tablet | ≥ 768px | `md:` |
| Desktop | ≥ 1024px | `lg:` |
| Large Desktop | ≥ 1280px | `xl:` |

---

## 🔧 Customization Guide

### Change Colors
Edit `tailwind.config.ts`:
```typescript
colors: {
  'ruhiz-teal': '#YOUR_COLOR',
  'ruhiz-light-teal': '#YOUR_COLOR',
}
```

### Change Fonts
Edit `app/globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=YOUR_FONT');
```

### Add New Pages
Create files in the `app/` directory:
```bash
app/
├── about/
│   └── page.tsx
├── contact/
│   └── page.tsx
```

### Modify Components
All components are in `components/` directory - fully editable!

---

## 🚢 Deployment

### Deploy to Vercel (Recommended)
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify
1. Connect your Git repository
2. Set build command: `npm run build`
3. Set publish directory: `.next`

### Deploy to Any Host
```bash
npm run build
npm start
```
Runs on port 3000 by default.

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | ^15.1.6 | React framework |
| react | ^19.0.0 | UI library |
| typescript | ^5.7.3 | Type safety |
| tailwindcss | ^3.4.17 | Styling |

---

## ✅ Checklist

- [x] Pixel-perfect match to reference design
- [x] Fully responsive layout
- [x] TypeScript enabled
- [x] Production-ready build
- [x] Image optimization
- [x] SEO metadata
- [x] Clean component structure
- [x] Tailwind CSS setup
- [x] Font loading optimized

---

## 🆘 Troubleshooting

### Port 3000 already in use
```bash
# Kill process on port 3000
kill -9 $(lsof -ti:3000)
# Or use different port
PORT=3001 npm run dev
```

### Images not loading
- Check images are in `public/images/`
- Verify paths start with `/images/` not `../`
- Clear `.next` folder: `rm -rf .next`

### Build errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

### TypeScript errors
```bash
# Check types
npx tsc --noEmit

# Fix formatting
npx prettier --write .
```

---

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [React Documentation](https://react.dev)

---

## 💡 Next Steps

1. **Add Authentication**: Implement user login/signup
2. **Connect Backend**: Add API routes or connect to CMS
3. **Add More Pages**: About, Resources, Community pages
4. **Add Animations**: Use Framer Motion for transitions
5. **Add Forms**: Contact forms, newsletter signup
6. **Add Analytics**: Google Analytics or Plausible
7. **Add Tests**: Jest + React Testing Library

---

## 📞 Support

For issues or questions:
- Check `DEVELOPMENT.md` for detailed documentation
- Review component files for implementation details
- Refer to Next.js documentation for framework-specific questions

---

**Built with ❤️ using Next.js, React, TypeScript, and Tailwind CSS**
