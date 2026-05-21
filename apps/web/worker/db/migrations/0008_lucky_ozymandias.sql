-- No-op. The schema changes for this migration (drop user_profile, add
-- profile_log, drop meal.kcal_total) were already applied via 0007.
-- This file exists only so the drizzle-kit meta snapshot (0008_snapshot.json)
-- can resync with the current schema.ts. Future `db:generate` calls now
-- diff against this snapshot, not the stale 0006.
SELECT 1;
