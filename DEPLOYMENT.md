# Ruhiz Deployment Guide

This guide covers deploying the Ruhiz website to various hosting platforms.

## ☁️ Vercel (Recommended)

Vercel is the creators of Next.js and offers the best integration.

### Option 1: Using Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod
```

### Option 2: Using GitHub Integration

1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Vercel auto-detects Next.js settings
6. Click "Deploy"

**Configuration:**
- Build Command: `npm run build` (auto-detected)
- Output Directory: `.next` (auto-detected)
- Install Command: `npm install` (auto-detected)

---

## 🌐 Netlify

### Using Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod
```

### Using Git Integration

1. Push code to GitHub/GitLab/Bitbucket
2. Visit [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your repository
5. Configure:
   - Build command: `npm run build`
   - Publish directory: `.next`
6. Click "Deploy site"

**netlify.toml** (optional):
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

## 🚀 AWS Amplify

### Using AWS Console

1. Visit [AWS Amplify Console](https://console.aws.amazon.com/amplify)
2. Click "New app" → "Host web app"
3. Connect your Git repository
4. Configure build settings:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm install
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
     cache:
       paths:
         - node_modules/**/*
   ```
5. Click "Save and deploy"

---

## 🌊 DigitalOcean App Platform

1. Visit [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect your repository
4. Configure:
   - Build Command: `npm run build`
   - Run Command: `npm start`
   - Environment: Node.js
5. Click "Launch App"

**app.yaml** (optional):
```yaml
name: ruhiz
services:
- name: web
  github:
    repo: your-username/ruhiz
    branch: main
  build_command: npm run build
  run_command: npm start
  environment_slug: node-js
  http_port: 3000
```

---

## 🐳 Docker Deployment

### Dockerfile

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
```

### Build and Run

```bash
# Build image
docker build -t ruhiz .

# Run container
docker run -p 3000:3000 ruhiz

# Using docker-compose
docker-compose up -d
```

---

## 🖥️ VPS / Traditional Hosting

For any Linux server with Node.js:

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Deploy Application

```bash
# Clone or upload your code
git clone your-repo.git ruhiz
cd ruhiz

# Install dependencies
npm install

# Build
npm run build

# Test
npm start
```

### 3. Use PM2 for Process Management

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "ruhiz" -- start

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### 4. Configure Nginx (Reverse Proxy)

Create `/etc/nginx/sites-available/ruhiz`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/ruhiz /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🔒 Environment Variables

For production deployments, set these environment variables:

```bash
NODE_ENV=production
PORT=3000
# Add your custom variables here
```

### Vercel
Dashboard → Project → Settings → Environment Variables

### Netlify
Dashboard → Site settings → Environment variables

### Docker
Add to `docker-compose.yml` or `.env` file

---

## 📊 Post-Deployment Checklist

- [ ] Test all pages load correctly
- [ ] Verify images display properly
- [ ] Check responsive design on mobile
- [ ] Test navigation links
- [ ] Verify forms work (if added)
- [ ] Check browser console for errors
- [ ] Test page load speed
- [ ] Verify SSL certificate (HTTPS)
- [ ] Test on multiple browsers
- [ ] Set up monitoring/analytics

---

## 🔍 Monitoring

### Vercel Analytics
Built-in analytics available in Vercel dashboard

### Google Analytics
Add to `app/layout.tsx`:
```typescript
<Script
  src={`https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID`}
  strategy="afterInteractive"
/>
```

### Uptime Monitoring
- [UptimeRobot](https://uptimerobot.com/)
- [Pingdom](https://www.pingdom.com/)
- [StatusCake](https://www.statuscake.com/)

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Images Not Loading
- Ensure images are in `public/images/`
- Check file permissions
- Verify image paths start with `/images/`

### Port Already in Use
```bash
# Change port in package.json
"start": "next start -p 3001"
```

### Memory Issues
Add to `next.config.js`:
```javascript
module.exports = {
  experimental: {
    workerThreads: false,
    cpus: 1
  }
}
```

---

## 📱 Performance Tips

1. **Enable Image Optimization**
   - Already configured with Next.js Image component

2. **Enable Gzip Compression**
   - Automatic with Vercel/Netlify
   - For Nginx, add to config:
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json application/javascript;
   ```

3. **Add Caching Headers**
   - In `next.config.js`:
   ```javascript
   async headers() {
     return [
       {
         source: '/images/:path*',
         headers: [
           {
             key: 'Cache-Control',
             value: 'public, max-age=31536000, immutable',
           },
         ],
       },
     ]
   }
   ```

---

## 🎯 Production URL Examples

After deployment, your site will be available at:

- **Vercel**: `https://ruhiz.vercel.app` or your custom domain
- **Netlify**: `https://ruhiz.netlify.app` or your custom domain
- **AWS**: `https://yourapp.amplifyapp.com` or your custom domain
- **Custom Server**: `https://yourdomain.com`

---

**🎉 Congratulations on deploying Ruhiz!**
