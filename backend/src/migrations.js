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
      output_text TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `)
}


