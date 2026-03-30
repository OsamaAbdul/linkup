# Supabase Database Transition & Migration Strategy 🏗️

This plan provides a deterministic path for consolidating 130+ legacy migrations and safely moving the LinkUp Marketplace system to a new Supabase database instance.

---

## 1. Migration Strategy: The "Squash & Baseline" Pattern

When moving to a **new database**, running 130+ incremental scripts is error-prone. We move to a **Baseline Strategy**.

### A. The Baseline (Current Truth)
1.  **Generate a Snapshot**: Use `supabase db remote commit` (if remote exists) or consolidate all core DDL into a single `20260401000000_baseline.sql`.
2.  **Order of Consolidation**: 
    - Extensions (UUID-OSSP, PostGIS).
    - Schemas (Public, Auth-related).
    - Enums & Types.
    - Tables (Base tables first, then joining tables).
    - Functions & Triggers.
    - RLS Policies & Grants.

### B. Rollback Path
- **Snapshotting**: Before any production migration, perform a `supabase db dump`.
- **Reversion**: Maintain a `ROLLBACK_baseline.sql` that drops the newly created schemas (if applicable) or reverts the system to the last known-good backup.

---

## 2. Dependency & Order Resolution

### Naming & Prioritization
Supabase executes files in **lexicographical order**.
- **0000-0999**: Core Infra (Extensions, Schemas, Custom Types).
- **1000-4999**: Schema (Tables, Foreign Keys).
- **5000-7999**: Business Logic (Functions, Triggers, RPCs).
- **8000-9999**: Security (RLS Policies, Roles, Permissions).

### Identifying Dependencies
- Always check if a function uses a column added in a different file. 
- **Rule**: If `File B` references a table defined in `File A`, `A` MUST have a smaller timestamp prefix.

---

## 3. Consolidated Runbook (Fresh Deploy)

### Fresh Deploy to New Database
1.  **Initialize**: `npx supabase init`
2.  **Add Baseline**: Place your consolidated `baseline.sql` in `supabase/migrations`.
3.  **Local Test**: `npx supabase start` (Verify error-free initialization).
4.  **Link New Project**: `npx supabase link --project-ref [NEW_PROJECT_ID]`
5.  **Push**: `npx supabase db push`
6.  **Verify**: Log into the Dashbaord and check for table count and RLS status.

### Incremental Upgrade
1.  Generate new migration: `npx supabase migration new feature_name`
2.  Apply locally: `npx supabase migration up`
3.  Push to remote: `npx supabase db push`

---

## 4. Environment & Validation

### Environment Tiers
- **Local (Docker)**: For risky schema experiments and unit testing.
- **Staging (Supabase Project B)**: For integration testing with real edge functions.
- **Production (Supabase Project A)**: Immutable; only updated via `db push`.

### Post-Migration Validation Checklist
- [ ] Run `SELECT * FROM public.profiles LIMIT 1` (Verify read access).
- [ ] Test Signup/Login flow (Verify Auth triggers).
- [ ] Verify RLS: Check if an anonymous user can see public data but not private data.

---

## 5. Risk Mitigation & Transformation

### Data Transformation Risks
- If shifting columns, use a **Dual-Write period**:
    1.  Add new column.
    2.  Update code to write to BOTH.
    3.  Run a migration to backfill old data to new column.
    4.  Update code to read from only new column.
    5.  Drop old column.

### Conflict Resolution
- **23505 (Duplicate Key)**: Use `INSERT ... ON CONFLICT (user_id) DO UPDATE`.
- **42701 (Column Exists)**: Wrap in `DO $$ BEGIN IF NOT EXISTS ... END $$;`.

---

## 6. Sample Migration Bundle (Example)

```sql
-- 20260401000000_baseline_example.sql

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON public.profiles FOR SELECT USING (true);
```
