


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_simulation_results"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM simulation_results
  WHERE portfolio_id = NEW.portfolio_id
    AND id NOT IN (
      SELECT id FROM simulation_results
      WHERE portfolio_id = NEW.portfolio_id
      ORDER BY created_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."cleanup_old_simulation_results"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_portfolio"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO portfolios (user_id, name, cash_balance)
  VALUES (NEW.id, 'My Portfolio', 0);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_portfolio"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_portfolio_value"("p_portfolio_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_cash NUMERIC;
  v_positions_value NUMERIC;
BEGIN
  SELECT cash_balance INTO v_cash FROM portfolios WHERE id = p_portfolio_id;

  -- Note: This doesn't include current prices - just shares * avg_cost
  SELECT COALESCE(SUM(shares * COALESCE(avg_cost, 0)), 0)
  INTO v_positions_value
  FROM positions
  WHERE portfolio_id = p_portfolio_id;

  RETURN COALESCE(v_cash, 0) + v_positions_value;
END;
$$;


ALTER FUNCTION "public"."get_portfolio_value"("p_portfolio_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_portfolio_revision"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_portfolio_revision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."correlation_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "correlation_matrix" "jsonb" NOT NULL,
    "method" "text" DEFAULT 'historical'::"text",
    "tickers" "text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."correlation_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factor_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "run_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "factor_exposures" "jsonb" NOT NULL,
    "r_squared" numeric,
    "residual_vol" numeric,
    "position_betas" "jsonb",
    "risk_contribution" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."factor_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_data_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "symbol" "text" NOT NULL,
    "data_type" "text" DEFAULT 'price_history'::"text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "fetched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."market_data_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."optimization_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "run_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "objective" "text" DEFAULT 'max_sharpe'::"text",
    "constraints" "jsonb",
    "optimal_weights" "jsonb" NOT NULL,
    "expected_return" numeric,
    "expected_volatility" numeric,
    "sharpe_ratio" numeric,
    "efficient_frontier" "jsonb",
    "current_metrics" "jsonb",
    "improvement" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."optimization_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolio_settings" (
    "portfolio_id" "uuid" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."portfolio_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."portfolios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'My Portfolio'::"text" NOT NULL,
    "cash_balance" numeric DEFAULT 0 NOT NULL,
    "revision" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."portfolios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "symbol" "text" NOT NULL,
    "shares" numeric NOT NULL,
    "avg_cost" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "p5" numeric,
    "p25" numeric,
    "p50" numeric,
    "p75" numeric,
    "p95" numeric,
    "price" numeric,
    "position_type" "text" DEFAULT 'Equity'::"text"
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."positions"."p5" IS '5th percentile annual return estimate';



COMMENT ON COLUMN "public"."positions"."p25" IS '25th percentile annual return estimate';



COMMENT ON COLUMN "public"."positions"."p50" IS '50th percentile (median) annual return estimate';



COMMENT ON COLUMN "public"."positions"."p75" IS '75th percentile annual return estimate';



COMMENT ON COLUMN "public"."positions"."p95" IS '95th percentile annual return estimate';



CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "report_type" "text" DEFAULT 'full'::"text",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "included_sections" "text"[],
    "portfolio_value" numeric,
    "num_positions" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."simulation_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "portfolio_id" "uuid" NOT NULL,
    "run_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "num_paths" integer NOT NULL,
    "method" "text" DEFAULT 'quasi-monte-carlo'::"text",
    "mean_return" numeric,
    "median_return" numeric,
    "std_dev" numeric,
    "var_95" numeric,
    "cvar_95" numeric,
    "sharpe_ratio" numeric,
    "max_drawdown" numeric,
    "percentiles" "jsonb",
    "path_endpoints" numeric[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."simulation_results" OWNER TO "postgres";


ALTER TABLE ONLY "public"."correlation_overrides"
    ADD CONSTRAINT "correlation_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factor_results"
    ADD CONSTRAINT "factor_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_data_cache"
    ADD CONSTRAINT "market_data_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_data_cache"
    ADD CONSTRAINT "market_data_cache_user_id_symbol_data_type_key" UNIQUE ("user_id", "symbol", "data_type");



ALTER TABLE ONLY "public"."optimization_results"
    ADD CONSTRAINT "optimization_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."portfolio_settings"
    ADD CONSTRAINT "portfolio_settings_pkey" PRIMARY KEY ("portfolio_id");



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."simulation_results"
    ADD CONSTRAINT "simulation_results_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_correlation_portfolio" ON "public"."correlation_overrides" USING "btree" ("portfolio_id");



CREATE UNIQUE INDEX "idx_correlation_portfolio_unique" ON "public"."correlation_overrides" USING "btree" ("portfolio_id");



CREATE INDEX "idx_factor_portfolio" ON "public"."factor_results" USING "btree" ("portfolio_id");



CREATE INDEX "idx_market_cache_expires" ON "public"."market_data_cache" USING "btree" ("expires_at");



CREATE INDEX "idx_market_cache_symbol" ON "public"."market_data_cache" USING "btree" ("symbol");



CREATE INDEX "idx_market_cache_user" ON "public"."market_data_cache" USING "btree" ("user_id");



CREATE INDEX "idx_optimization_portfolio" ON "public"."optimization_results" USING "btree" ("portfolio_id");



CREATE INDEX "idx_portfolios_user" ON "public"."portfolios" USING "btree" ("user_id");



CREATE INDEX "idx_positions_portfolio" ON "public"."positions" USING "btree" ("portfolio_id");



CREATE INDEX "idx_reports_date" ON "public"."reports" USING "btree" ("generated_at" DESC);



CREATE INDEX "idx_reports_portfolio" ON "public"."reports" USING "btree" ("portfolio_id");



CREATE INDEX "idx_simulation_date" ON "public"."simulation_results" USING "btree" ("run_date" DESC);



CREATE INDEX "idx_simulation_portfolio" ON "public"."simulation_results" USING "btree" ("portfolio_id");



CREATE OR REPLACE TRIGGER "cleanup_simulations" AFTER INSERT ON "public"."simulation_results" FOR EACH ROW EXECUTE FUNCTION "public"."cleanup_old_simulation_results"();



CREATE OR REPLACE TRIGGER "portfolio_settings_updated_at" BEFORE UPDATE ON "public"."portfolio_settings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "portfolios_updated_at" BEFORE UPDATE ON "public"."portfolios" FOR EACH ROW EXECUTE FUNCTION "public"."update_portfolio_revision"();



CREATE OR REPLACE TRIGGER "positions_updated_at" BEFORE UPDATE ON "public"."positions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."correlation_overrides"
    ADD CONSTRAINT "correlation_overrides_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."factor_results"
    ADD CONSTRAINT "factor_results_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_data_cache"
    ADD CONSTRAINT "market_data_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."optimization_results"
    ADD CONSTRAINT "optimization_results_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portfolio_settings"
    ADD CONSTRAINT "portfolio_settings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."portfolios"
    ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."simulation_results"
    ADD CONSTRAINT "simulation_results_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE CASCADE;



CREATE POLICY "Users can CRUD own correlations" ON "public"."correlation_overrides" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can CRUD own factor results" ON "public"."factor_results" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can CRUD own market cache" ON "public"."market_data_cache" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can CRUD own optimization results" ON "public"."optimization_results" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can CRUD own portfolios" ON "public"."portfolios" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD own reports" ON "public"."reports" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can CRUD own settings" ON "public"."portfolio_settings" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can CRUD own simulations" ON "public"."simulation_results" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can CRUD positions in own portfolios" ON "public"."positions" USING (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"())))) WITH CHECK (("portfolio_id" IN ( SELECT "portfolios"."id"
   FROM "public"."portfolios"
  WHERE ("portfolios"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."correlation_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."factor_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_data_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."optimization_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolio_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."portfolios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."simulation_results" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_simulation_results"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_simulation_results"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_simulation_results"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_portfolio"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_portfolio"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_portfolio"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_portfolio_value"("p_portfolio_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_portfolio_value"("p_portfolio_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_portfolio_value"("p_portfolio_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_portfolio_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_portfolio_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_portfolio_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."correlation_overrides" TO "anon";
GRANT ALL ON TABLE "public"."correlation_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."correlation_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."factor_results" TO "anon";
GRANT ALL ON TABLE "public"."factor_results" TO "authenticated";
GRANT ALL ON TABLE "public"."factor_results" TO "service_role";



GRANT ALL ON TABLE "public"."market_data_cache" TO "anon";
GRANT ALL ON TABLE "public"."market_data_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."market_data_cache" TO "service_role";



GRANT ALL ON TABLE "public"."optimization_results" TO "anon";
GRANT ALL ON TABLE "public"."optimization_results" TO "authenticated";
GRANT ALL ON TABLE "public"."optimization_results" TO "service_role";



GRANT ALL ON TABLE "public"."portfolio_settings" TO "anon";
GRANT ALL ON TABLE "public"."portfolio_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolio_settings" TO "service_role";



GRANT ALL ON TABLE "public"."portfolios" TO "anon";
GRANT ALL ON TABLE "public"."portfolios" TO "authenticated";
GRANT ALL ON TABLE "public"."portfolios" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."simulation_results" TO "anon";
GRANT ALL ON TABLE "public"."simulation_results" TO "authenticated";
GRANT ALL ON TABLE "public"."simulation_results" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







