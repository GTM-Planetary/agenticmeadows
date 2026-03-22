-- AgenticMeadows PostgreSQL Initialization
-- This runs after Prisma migrations via docker-entrypoint-initdb.d
-- Adds constraints and seed data that Prisma cannot express natively.

-- NOTE: The Prisma migration runs at backend startup (prisma migrate deploy).
-- This file adds post-migration constraints and development seed data.
-- It is safe to run multiple times (idempotent where possible).

-- ── LineItem: exactly one parent constraint ───────────────────────────────────
-- Runs after Prisma creates the LineItem table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lineitem_has_one_parent'
  ) THEN
    -- We use a deferred approach: attempt to add the constraint.
    -- If "LineItem" doesn't exist yet (first boot before migration), skip gracefully.
    BEGIN
      ALTER TABLE "LineItem"
        ADD CONSTRAINT "lineitem_has_one_parent" CHECK (
          (
            CASE WHEN "jobId"     IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN "quoteId"   IS NOT NULL THEN 1 ELSE 0 END +
            CASE WHEN "invoiceId" IS NOT NULL THEN 1 ELSE 0 END
          ) = 1
        );
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE 'LineItem table does not exist yet — constraint will be added after migration.';
    END;
  END IF;
END;
$$;

-- ── Development Seed Data ─────────────────────────────────────────────────────
-- Creates a default admin user and sample client for dev/demo purposes.
-- Password: "password123" (bcrypt hash, cost 10)

INSERT INTO "User" (id, name, email, "passwordHash", role, "createdAt")
VALUES (
  'usr_admin_seed',
  'Admin User',
  'admin@turf.local',
  '$2a$10$0uB.d4yeghl4f7pKHE2f7uV1zGwmiAZp9jxtgej1NDPTYTIzhN1Wy',
  'ADMIN',
  NOW()
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO "Client" (id, "firstName", "lastName", email, phone, company, notes, "createdAt", "updatedAt")
VALUES (
  'cli_demo_001',
  'John',
  'Demo',
  'john.demo@example.com',
  '555-0100',
  'Demo Properties LLC',
  'Sample client for development testing',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Property" (id, "clientId", "streetAddress", city, state, zip, notes)
VALUES (
  'prp_demo_001',
  'cli_demo_001',
  '123 Meadow Lane',
  'Springfield',
  'IL',
  '62701',
  '0.5 acre lot with front and rear lawn, two garden beds'
)
ON CONFLICT (id) DO NOTHING;
