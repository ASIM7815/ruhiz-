# IMPORTANT NEXT STEPS - Landing Page Redesign

## Status: Phase 1-3 Complete ✅

The landing page redesign for engineering students is **functionally complete**. All new content, messaging, and components are in place. However, there are **critical remaining tasks** before this can be deployed.

---

## 🚨 Critical Issues (Must Fix Before Deploy)

### 1. TypeScript Errors from Old Category References
**Issue:** Other parts of the codebase still reference old category IDs that no longer exist.

**Errors:**
```
src/app/api/feed/route.ts - References old categories
src/components/feed/ComposerModal.tsx - Default category 'community' doesn't exist
```

**Root Cause:** We updated the CategoryId type and meta.ts categories, but the database and other components haven't been migrated yet.

**Solution Options:**

**Option A: Keep Old Categories in Database** (Recommended for now)
- The new landing page works independently of the database
- Landing page can launch with new messaging
- Backend continues using old categories
- Full category migration happens in Phase 2

**Option B: Full Category Migration** (Complete solution)
1. Create database migration to rename category_id values
2. Update all seed data
3. Update ComposerModal default
4. Update any API routes that hardcode category IDs
5. Test thoroughly

**Recommended:** Use Option A for now. The landing page doesn't interact with the database directly. The TypeScript errors are in feed/composer functionality that's behind auth.

---

## 📸 High Priority: Image Implementation

### What's Missing
- All placeholder images need to be replaced with real ones
- IMAGE_MANIFEST.md has the complete list

### Required Images (Per Manifest)
1. **Hero section** - Students collaborating on campus (1920x1080px)
2. **Problem cards backgrounds** - 6 images for different scenarios
3. **Journey stages** - 5 images showing each stage
4. **Categories** - 6 images for category illustrations
5. **Stats background** - Students celebrating (1920x800px)
6. **Closing CTA** - Achievement/graduation scene (1920x800px)

### Implementation Steps
1. Download from Unsplash/Pexels using keywords in manifest
2. Optimize to WebP format (<200KB each)
3. Create responsive versions (@1x, @2x)
4. Replace placeholder image paths in components
5. Add proper alt text
6. Implement lazy loading
7. Test on high-DPI displays

**Time Estimate:** 4-6 hours

---

## 🎨 Medium Priority: Visual Polish

### Micro-interactions (Task 13)
- [ ] Hover effects on all cards
- [ ] Button transition polish
- [ ] Scroll-triggered animations refinement
- [ ] Category card interactions
- [ ] Journey stage tooltips

### Responsive Testing (Task 14)
- [ ] iPhone SE (375px)
- [ ] iPhone 12/13 (390px)
- [ ] iPad (768px)
- [ ] iPad Pro (1024px)
- [ ] Desktop (1280px, 1920px)
- [ ] Ultra-wide (2560px)
- [ ] Landscape orientation
- [ ] Browser zoom 200%

**Time Estimate:** 2-3 hours

---

## ⚡ Performance Optimization (Task 17)

### Current Status
- TypeScript compiles with known errors (non-landing-page code)
- No runtime errors expected on landing page
- Bundle size not yet optimized

### Required Optimizations
1. Run Lighthouse audit
2. Optimize bundle size (code splitting)
3. Remove unused CSS with PurgeCSS
4. Optimize font loading
5. Add proper meta tags for Core Web Vitals

### Targets
- Lighthouse: 90+ on all metrics
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1

**Time Estimate:** 2-3 hours

---

## 📄 SEO & Legal (Task 15-16)

### SEO Metadata (Task 15)
- [ ] Update page title
- [ ] Add meta description
- [ ] Implement Open Graph tags
- [ ] Add Twitter Card tags
- [ ] Create JSON-LD structured data
- [ ] Test social sharing previews

### Image Attribution (Task 16)
- [ ] Create `/image-credits` page
- [ ] List all photographers
- [ ] Document licenses
- [ ] Link from footer

**Time Estimate:** 1-2 hours

---

## 🔧 Technical Debt Resolution

### Category Migration Path

**Short-term (to unblock landing page):**
1. Keep both old and new CategoryId types temporarily
2. Landing page uses new engineering categories
3. Backend/feed continues using old categories
4. No user-facing impact

**Long-term (proper migration):**
1. Create `db/migrations/0004_engineering_categories.sql`
2. Map old categories to new ones:
   ```sql
   mental-health → mental-wellness
   education → exam-strategies  
   technology → tech-exploration
   career → career-guidance
   etc.
   ```
3. Update all existing posts with new category_id
4. Update ComposerModal default
5. Remove old CategoryId types

---

## 🚀 Deployment Checklist

### Before Deploy
- [ ] Fix TypeScript errors OR document as known issue
- [ ] Implement all images from manifest
- [ ] Run Lighthouse audit (target: 90+)
- [ ] Test on real devices (iOS + Android)
- [ ] Verify all links work
- [ ] Check mobile menu functionality
- [ ] Test form submissions (newsletter)
- [ ] Verify analytics tracking (if implemented)

### Deploy Process
1. **Staging first** - Deploy to staging environment
2. **User testing** - Get feedback from 5-10 engineering students
3. **Iterate** - Fix any confusing messaging or UX issues
4. **Production** - Deploy to main domain
5. **Monitor** - Watch analytics for bounce rate, time on site

### Post-Deploy Monitoring
- [ ] Check Google Analytics/Plausible for traffic
- [ ] Monitor Core Web Vitals in Search Console
- [ ] Track conversion rate (signups from landing page)
- [ ] Collect user feedback
- [ ] A/B test different headlines if needed

---

## 📊 Success Metrics

### Immediate (Week 1)
- Lighthouse score 90+ on all metrics
- Page load time <3s on 3G
- Zero console errors
- Mobile-friendly test passes

### Short-term (Month 1)
- 20% increase in signup conversion rate
- 30% decrease in bounce rate
- Positive feedback from engineering students
- "Made for engineers" sentiment in user interviews

### Long-term (Quarter 1)
- 50%+ of new users are engineering students
- Active participation in engineering-specific categories
- Students sharing platform with classmates organically
- Positive word-of-mouth on college campuses

---

## 🎯 Prioritized Action Plan

### This Week
1. **Fix TypeScript Errors** - 1 hour
   - Document as known issue OR implement quick fix
2. **Download & Implement Images** - 6 hours  
   - Follow IMAGE_MANIFEST.md
   - Optimize and integrate
3. **Performance Audit** - 2 hours
   - Run Lighthouse
   - Fix critical issues

### Next Week
1. **Responsive Testing** - 3 hours
   - Test all devices
   - Fix layout issues
2. **SEO Implementation** - 2 hours
   - Meta tags
   - Open Graph
   - JSON-LD
3. **Image Credits Page** - 1 hour
   - Create attribution page
   - Link from footer

### Week 3
1. **Deploy to Staging** - 1 hour
2. **User Testing** - Ongoing
3. **Iterate Based on Feedback** - 2-4 hours
4. **Production Deploy** - 1 hour

---

## 💡 Key Learnings

### What Worked Well
- Preserving existing architecture while refreshing content
- Component-by-component approach
- Comprehensive documentation
- Engineering-specific messaging resonates

### What to Watch
- Category migration needs proper planning
- Image sourcing takes longer than expected
- Performance optimization is critical for student users (often on mobile/slow networks)

### Future Enhancements
- Add student testimonials (real quotes)
- Create video walkthrough of platform
- Add campus ambassador program landing page
- Implement job board for engineering roles
- Create placement success stories showcase

---

## 📞 Questions or Issues?

If you encounter any issues during implementation:

1. **TypeScript errors:** Check if they're in landing page code or backend code
2. **Missing icons:** Lucide deprecated brand icons - use ExternalLink as fallback
3. **Image optimization:** Use Squoosh.app or ImageOptim
4. **Performance issues:** Check bundle size with `npm run build`

---

**Document Updated:** October 17, 2026  
**Status:** Landing page redesign complete, ready for image implementation  
**Blocker:** Image assets needed before production deploy  
**Est. Time to Production-Ready:** 10-15 hours of focused work
