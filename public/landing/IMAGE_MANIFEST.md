# RUHIZ Landing Page - Image Manifest

This document tracks all images used on the RUHIZ landing page for engineering students, including attribution and licensing information.

## Image Sources
All images are sourced from Unsplash (https://unsplash.com) under the Unsplash License, which allows free use for commercial and non-commercial purposes without permission or attribution required (though attribution is appreciated and provided here).

## Directory Structure
```
/public/landing/
├── hero/           - Hero section images
├── journey/        - Journey stage images
├── categories/     - Category illustration images
├── community/      - Community/stats section images
├── backgrounds/    - Background textures and overlays
└── stats/          - Statistics section background
```

## Images to Download from Unsplash

### 1. Hero Section (`/hero/`)

**hero-main.jpg**
- **Search**: "engineering students collaborating laptop campus"
- **Recommended**: Group of 3-4 diverse students working together on laptops in modern campus setting
- **Specs**: 1920x1080px minimum, WebP format, <200KB
- **Photographer**: TBD (download from Unsplash)
- **License**: Unsplash License
- **Usage**: Main hero background image

### 2. Problem Section (`/backgrounds/`)

**problem-exam-stress.jpg**
- **Search**: "student stressed studying laptop night"
- **Usage**: Problem card - "stuck on DSA concepts"
- **Specs**: 800x600px, WebP, <150KB

**problem-isolation.jpg**
- **Search**: "student alone library studying"
- **Usage**: Problem card - "feeling left behind"
- **Specs**: 800x600px, WebP, <150KB

**problem-project.jpg**
- **Search**: "student presenting project"
- **Usage**: Problem card - "no one sees my work"
- **Specs**: 800x600px, WebP, <150KB

**problem-burnout.jpg**
- **Search**: "tired student laptop coffee"
- **Usage**: Problem card - "overwhelming workload"
- **Specs**: 800x600px, WebP, <150KB

**problem-career.jpg**
- **Search**: "student thinking career laptop"
- **Usage**: Problem card - "right skills for industry"
- **Specs**: 800x600px, WebP, <150KB

**problem-placement.jpg**
- **Search**: "anxious student interview preparation"
- **Usage**: Problem card - "placement anxiety"
- **Specs**: 800x600px, WebP, <150KB

### 3. Journey Section (`/journey/`)

**journey-1-problem.jpg**
- **Search**: "student confused computer programming"
- **Usage**: Stage 1 - Share Your Problem
- **Specs**: 600x400px, WebP, <100KB

**journey-2-discussion.jpg**
- **Search**: "students discussing laptop code"
- **Usage**: Stage 2 - Get Peer Insights
- **Specs**: 600x400px, WebP, <100KB

**journey-3-build.jpg**
- **Search**: "students coding together programming"
- **Usage**: Stage 3 - Build Together
- **Specs**: 600x400px, WebP, <100KB

**journey-4-showcase.jpg**
- **Search**: "student presenting project demo"
- **Usage**: Stage 4 - Showcase Your Work
- **Specs**: 600x400px, WebP, <100KB

**journey-5-mentor.jpg**
- **Search**: "student helping another student laptop"
- **Usage**: Stage 5 - Help Others
- **Specs**: 600x400px, WebP, <100KB

### 4. Categories Section (`/categories/`)

**cat-coding.jpg**
- **Search**: "student coding laptop dark"
- **Usage**: Coding & DSA category
- **Specs**: 500x400px, WebP, <100KB

**cat-project.jpg**
- **Search**: "engineering project electronics breadboard"
- **Usage**: Project Help category
- **Specs**: 500x400px, WebP, <100KB

**cat-placement.jpg**
- **Search**: "job interview student professional"
- **Usage**: Placement Prep category
- **Specs**: 500x400px, WebP, <100KB

**cat-hackathon.jpg**
- **Search**: "hackathon students team working"
- **Usage**: Hackathons category
- **Specs**: 500x400px, WebP, <100KB

**cat-campus.jpg**
- **Search**: "college campus students outdoor"
- **Usage**: Campus Life category
- **Specs**: 500x400px, WebP, <100KB

**cat-lab.jpg**
- **Search**: "engineering lab equipment students"
- **Usage**: Labs & Practicals category
- **Specs**: 500x400px, WebP, <100KB

### 5. Stats Section (`/stats/`)

**stats-background.jpg**
- **Search**: "diverse students celebrating success campus"
- **Usage**: Background for statistics section
- **Specs**: 1920x800px, WebP, <200KB

### 6. Community/Closing (`/community/`)

**closing-celebration.jpg**
- **Search**: "students celebrating achievement graduation"
- **Usage**: Final CTA section background
- **Specs**: 1920x800px, WebP, <200KB

### 7. Background Textures (`/backgrounds/`)

**circuit-pattern.png**
- **Search**: "circuit board pattern texture"
- **Usage**: Decorative background overlay
- **Specs**: 1920x1080px, PNG with transparency, <100KB

**code-snippet-blur.jpg**
- **Search**: "code programming screen blur"
- **Usage**: Decorative background for feature cards
- **Specs**: 1920x1080px, heavily blurred, WebP, <150KB

## Download Instructions

1. Visit Unsplash.com
2. Search for each keyword phrase above
3. Select high-quality images matching the description
4. Download in maximum resolution
5. Optimize using ImageOptim or Squoosh:
   - Convert to WebP format
   - Resize to specified dimensions
   - Compress to target file size
   - Save with specified filename

## Image Optimization Checklist

- [ ] Convert all images to WebP format (with JPEG fallback)
- [ ] Create responsive versions: @1x, @2x, @3x
- [ ] Compress to target file sizes
- [ ] Add proper alt text in components
- [ ] Implement lazy loading for below-fold images
- [ ] Add blur placeholder data URIs
- [ ] Test on high-DPI displays (Retina)
- [ ] Verify Lighthouse performance score >90

## Attribution Template

When implementing images in components, use this attribution pattern in comments:

```tsx
{/* 
  Image: [Description]
  Photographer: [Name]
  Source: Unsplash
  URL: https://unsplash.com/photos/[photo-id]
  License: Unsplash License (free commercial use)
*/}
```

## Notes

- All images must feature diverse representation (gender, ethnicity)
- Avoid overly posed or stock-looking photos
- Prefer authentic campus/lab/coding environments
- Ensure images are well-lit and high resolution
- Check that faces are visible and expressive where applicable
- Verify no copyrighted brands/logos are prominently displayed

## Next Steps

1. Download all images from Unsplash
2. Optimize for web (WebP conversion, compression)
3. Place in appropriate directories
4. Update this manifest with photographer credits and photo URLs
5. Implement images in React components with proper attribution
6. Create /image-credits page for public-facing attribution
