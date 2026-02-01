# Deployment

## What Was Implemented

Three-service deployment: Vercel (frontend), Cloudflare (worker), Supabase (database).

### Deployment URLs

| Service | URL | Dashboard |
|---------|-----|-----------|
| **Production App** | https://monte-carlo-app-ivory.vercel.app | https://vercel.com |
| **Cloudflare Worker** | https://monte-carlo-cache.kevinren1128.workers.dev | https://dash.cloudflare.com |
| **Supabase** | https://uoyvihrdllwslljminid.supabase.co | https://supabase.com/dashboard/project/uoyvihrdllwslljminid |

### Environment Variables

**Vercel Dashboard:**
```
VITE_SUPABASE_URL=https://uoyvihrdllwslljminid.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_WORKER_URL=https://monte-carlo-cache.kevinren1128.workers.dev
VITE_FMP_API_KEY=<fmp-key>
```

**Local Development (.env):**
```bash
VITE_SUPABASE_URL=https://uoyvihrdllwslljminid.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_WORKER_URL=https://monte-carlo-cache.kevinren1128.workers.dev
VITE_FMP_API_KEY=<optional>
SUPABASE_ACCESS_TOKEN=sbp_...  # For CLI only, not VITE_
```

## Key Decisions

### 1. Vercel for Frontend

**Why Vercel?**
- Optimized for React/Vite
- Automatic builds from GitHub
- Preview deployments for each PR
- Free tier sufficient

**Deploy process:**
1. Push to GitHub
2. Vercel auto-builds
3. Preview URL generated
4. Merge to main → production deploy

### 2. Separate Worker Deployment

**Why not Vercel Functions?**
- Cloudflare edge is faster
- KV storage for caching
- Different runtime optimized for our use case

**Deploy process:**
```bash
npx wrangler deploy
```

### 3. Supabase Managed Database

**Why not self-hosted?**
- Free tier is generous
- Managed backups
- Built-in auth
- No DevOps overhead

## Deploy Commands

**Frontend (automatic via GitHub):**
```bash
git push origin main  # Triggers Vercel build
```

**Worker:**
```bash
cd worker
npx wrangler deploy
```

**Database migrations:**
```bash
npx supabase db push
```

## What We Tried That Didn't Work

1. **Single Vercel deployment**
   - Problem: No edge caching, worker features
   - Solution: Separate Cloudflare Worker

2. **Environment variables in code**
   - Problem: Secrets exposed in bundle
   - Solution: Vercel dashboard + `import.meta.env`

3. **Manual deployments**
   - Problem: Easy to forget, inconsistent
   - Solution: GitHub → Vercel auto-deploy

## Gotchas

1. **VITE_ prefix required**
   - Vite only exposes `VITE_*` variables to client
   - `SUPABASE_ACCESS_TOKEN` won't work (no prefix)
   - Use `VITE_SUPABASE_ANON_KEY`

2. **OAuth redirect URLs**
   - Must update in BOTH Google Cloud AND Supabase
   - Add production AND localhost URLs
   - Common cause of auth failures

3. **Worker CORS**
   - Must add `Access-Control-Allow-Origin: *`
   - Handle OPTIONS preflight requests
   - Easy to forget after changes

4. **Build size warnings**
   - Vite warns about 500KB+ chunks
   - App.jsx is large, but acceptable
   - Consider code splitting in future

5. **Preview vs Production**
   - Preview deployments have different URLs
   - OAuth may not work on preview URLs
   - Test auth on production

## Cost Estimate

| Service | Free Tier | Expected Usage |
|---------|-----------|----------------|
| **Vercel** | 100GB bandwidth, unlimited deploys | ~1GB/month |
| **Cloudflare Workers** | 100K req/day | ~1-5K req/day |
| **Cloudflare KV** | 100K reads, 1K writes/day | ~5K reads, 100 writes/day |
| **Supabase Database** | 500 MB | ~10 MB |
| **Supabase Auth** | 50K MAU | ~5 users |

**Total: $0/month** on free tiers for personal use.

## Future Ideas

1. **Custom domain**
   - Add custom domain to Vercel
   - Update OAuth redirect URLs

2. **Staging environment**
   - Separate Supabase project for staging
   - Test migrations before production

3. **CI/CD improvements**
   - Run tests before deploy
   - Automated Worker deployment on merge

4. **Monitoring**
   - Add error tracking (Sentry)
   - Performance monitoring
   - Uptime alerts
