-- Fix: Materialized views don't inherit RLS from base tables
-- Must add explicit grants and policies to consensus_latest view

-- Grant SELECT to both anon and authenticated roles
GRANT SELECT ON consensus_latest TO anon, authenticated;

-- Note: Materialized views don't support RLS policies in PostgreSQL
-- The GRANT is sufficient since the view contains only shared/public data
