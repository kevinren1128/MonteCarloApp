# Deployment Guide: Monte Carlo Portfolio Simulator

This guide covers how to deploy your Monte Carlo Portfolio Simulator to the web. Since this is a client-side React app with no backend, you can host it on any static hosting platform.

---

## Quick Start: Build for Production

First, build your app for production:

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

This creates a `dist/` folder containing your production-ready files:
- `index.html`
- `assets/` (JS, CSS bundles)

You can preview the production build locally:
```bash
npm run preview
```

---

## Hosting Options (Easiest First)

### Option 1: Vercel (Recommended - Easiest)

Vercel is the company behind Next.js and offers excellent React/Vite support.

**Setup:**
1. Go to [vercel.com](https://vercel.com) and sign up (free with GitHub)
2. Click **"Add New" → "Project"**
3. Import your GitHub repository (or upload directly)
4. Vercel auto-detects Vite — just click **Deploy**
5. Done! You get a URL like `your-app.vercel.app`

**Or deploy from command line:**
```bash
npm install -g vercel
vercel
```

**Pros:** Zero-config, automatic HTTPS, global CDN, instant deploys
**Free tier:** Unlimited sites, 100GB bandwidth/month

---

### Option 2: Netlify

Another excellent option with drag-and-drop deployment.

**Setup (Drag & Drop):**
1. Run `npm run build` locally
2. Go to [netlify.com](https://netlify.com) and sign up
3. Drag your `dist/` folder onto the Netlify dashboard
4. Done! Instant URL like `random-name.netlify.app`

**Setup (Git Integration):**
1. Connect your GitHub repo
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy!

**Or deploy from command line:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Pros:** Drag-and-drop, form handling, serverless functions available
**Free tier:** 100GB bandwidth/month, unlimited sites

---

### Option 3: GitHub Pages (Free with GitHub)

Host directly from your GitHub repository.

**Setup:**
1. Update `vite.config.js` for GitHub Pages:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/your-repo-name/',  // Add this line
})
```

2. Install gh-pages:
```bash
npm install -D gh-pages
```

3. Add deploy scripts to `package.json`:
```json
{
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

4. Deploy:
```bash
npm run deploy
```

5. Enable GitHub Pages in your repo settings (Settings → Pages → Source: gh-pages branch)

**Your site:** `https://yourusername.github.io/your-repo-name/`

**Pros:** Free, integrated with GitHub
**Cons:** Requires config changes, URL includes repo name

---

### Option 4: Cloudflare Pages

Fast global CDN with generous free tier.

**Setup:**
1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Connect your GitHub/GitLab repo
3. Configure:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Deploy!

**Pros:** Fastest CDN, unlimited bandwidth on free tier
**Free tier:** Unlimited requests, 500 builds/month

---

### Option 5: Firebase Hosting (Google)

Good if you're already using Firebase services.

**Setup:**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting  # Select "dist" as public directory
npm run build
firebase deploy
```

---

## Configuration Files for Deployment

### Add a `netlify.toml` (for Netlify)

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Add a `vercel.json` (for Vercel)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Add `_redirects` file in `public/` (for Netlify/Cloudflare)

Create `public/_redirects`:
```
/*    /index.html   200
```

This ensures client-side routing works correctly.

---

## Environment Variables

If you add API keys or environment variables later:

1. Create `.env` file locally:
```
VITE_API_KEY=your_key_here
```

2. Access in code:
```javascript
const apiKey = import.meta.env.VITE_API_KEY
```

3. Add to your hosting platform's environment variables dashboard

---

## Custom Domain Setup

All platforms above support custom domains:

1. **Buy a domain** (Namecheap, Google Domains, Cloudflare, etc.)
2. **Add to your hosting platform:**
   - Vercel: Settings → Domains → Add
   - Netlify: Domain settings → Add custom domain
3. **Update DNS** (usually just add a CNAME record)
4. **HTTPS** is automatic on all platforms

---

## Recommended: Vercel One-Click Setup

For the absolute fastest setup:

1. Push your code to GitHub
2. Go to vercel.com/new
3. Import your repo
4. Click Deploy

That's it — you'll have a live URL in under 2 minutes.

---

## Checklist Before Deploying

- [ ] Test locally with `npm run build && npm run preview`
- [ ] Check that all features work in the production build
- [ ] Update `<title>` in `index.html` if needed
- [ ] Add a favicon (place in `public/favicon.ico`)
- [ ] Consider adding `robots.txt` and `sitemap.xml` if you want SEO

---

## Troubleshooting

**Blank page after deploy?**
- Check browser console for errors
- Ensure `base` in `vite.config.js` matches your deployment path
- Verify all assets are loading (Network tab)

**Routes not working (404 on refresh)?**
- Add redirect rules (see Configuration Files section above)
- This is needed for client-side routing (if you add it later)

**Build fails?**
- Run `npm run build` locally first to catch errors
- Check Node.js version matches (most platforms use Node 18+)

---

## Summary

| Platform | Difficulty | Free Tier | Best For |
|----------|------------|-----------|----------|
| Vercel | ⭐ Easiest | Excellent | Most users |
| Netlify | ⭐ Easy | Excellent | Drag & drop |
| Cloudflare | ⭐⭐ Easy | Best (unlimited) | Performance |
| GitHub Pages | ⭐⭐ Medium | Good | GitHub users |
| Firebase | ⭐⭐⭐ Medium | Good | Google ecosystem |

**My recommendation: Start with Vercel or Netlify** — you can always migrate later.
