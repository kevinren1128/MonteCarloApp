# Project Notes

This directory contains persistent project memory — a long-term knowledge base that grows with every task.

## Purpose

- Document architectural decisions and their rationale
- Record lessons learned and gotchas
- Track what we tried that didn't work (so we don't repeat mistakes)
- Capture future ideas and improvements
- Provide context for future development sessions

## How to Use

1. **Before starting a task**: Check relevant note files for context
2. **After completing a task**: Update notes with new learnings
3. **When debugging**: Check "Gotchas" and "What Didn't Work" sections
4. **When planning**: Review "Future Ideas" for inspiration

## Naming Conventions

- Use lowercase with hyphens: `feature-name.md`
- Be descriptive: `cloudflare-workers.md` not `cf.md`
- Group related topics: `auth-implementation.md` covers all auth

## File Structure

Each note file follows this template:

```markdown
# Feature Name

## What Was Implemented
Summary of the feature and its purpose.

## Key Decisions
Why we chose this approach over alternatives.

## What We Tried That Didn't Work
Failed approaches and why they failed.

## Gotchas
Non-obvious things to remember.

## Future Ideas
Improvements we might make.
```

## Index

| File | Description |
|------|-------------|
| [architecture-overview.md](./architecture-overview.md) | High-level system design |
| [auth-implementation.md](./auth-implementation.md) | Supabase auth, Google OAuth |
| [cloudflare-workers.md](./cloudflare-workers.md) | Yahoo Finance proxy, caching |
| [database-schema.md](./database-schema.md) | Supabase tables, RLS policies |
| [kv-caching.md](./kv-caching.md) | What's cached, TTLs, key structure |
| [financial-calculations.md](./financial-calculations.md) | Monte Carlo, distributions, factor analysis |
| [deployment.md](./deployment.md) | Vercel, environment variables, deploy process |
