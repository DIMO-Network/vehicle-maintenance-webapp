/**
 * Database migrations
 *
 * Usage:
 *   import { runMigrations } from './migrations.js'
 *   await runMigrations(pool)
 */

export async function runMigrations(pool) {
  // Create schema
  await pool.query(`CREATE SCHEMA IF NOT EXISTS vehicle_maintenance;`)

  // Create tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_maintenance.maintenance_records (
      id SERIAL PRIMARY KEY,
      token_id INTEGER NOT NULL,
      service_date DATE,
      total_cost NUMERIC(12,2),
      description TEXT,
      summary TEXT,
      mileage INTEGER,
      output_text TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)

  // Ensure new columns exist for existing deployments
  await pool.query(`
    ALTER TABLE vehicle_maintenance.maintenance_records
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS mileage INTEGER;
  `)
}


