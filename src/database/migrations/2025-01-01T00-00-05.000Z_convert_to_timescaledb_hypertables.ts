import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Enable TimescaleDB extension if not already enabled
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS timescaledb`.execute(db);
  } catch (error: any) {
    // If extension can't be created, check if it already exists
    const extCheck = await sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'timescaledb'
      ) as exists
    `.execute(db);
    
    const exists = extCheck.rows[0]?.exists;
    if (!exists) {
      throw new Error('TimescaleDB extension is not available. Please install TimescaleDB on your PostgreSQL server.');
    }
  }

  // Check if trades table exists
  const tableCheck = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'trades'
    ) as exists
  `.execute(db);
  
  const tradesExists = tableCheck.rows[0]?.exists;
  if (!tradesExists) {
    throw new Error('Trades table does not exist. Please run the create_trades_table migration first.');
  }

  // Check if already a hypertable
  const isHypertableCheck = await sql<{ is_hypertable: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM timescaledb_information.hypertables
      WHERE hypertable_name = 'trades'
      AND hypertable_schema = 'public'
    ) AS is_hypertable
  `.execute(db);
  
  const alreadyHypertable = isHypertableCheck.rows[0]?.is_hypertable;
  
  if (!alreadyHypertable) {
    await sql`
      SELECT create_hypertable(
        'trades',
        'created_at',
        chunk_time_interval => INTERVAL '1 day',
        if_not_exists => TRUE
      )
    `.execute(db);
  }

  // Create additional indexes optimized for time-series queries on trades
  // Composite index for market + time range queries
  try {
    await db.schema
      .createIndex('idx_trades_market_time_bucket')
      .on('trades')
      .columns(['market_id', 'created_at'])
      .ifNotExists()
      .execute();
  } catch (error: any) {
    // Index might already exist, ignore error
    console.warn('Could not create idx_trades_market_time_bucket:', error?.message || error);
  }

  // Index for price queries on trades (for OHLC calculations)
  try {
    await db.schema
      .createIndex('idx_trades_market_price_time')
      .on('trades')
      .columns(['market_id', 'price', 'created_at'])
      .ifNotExists()
      .execute();
  } catch (error: any) {
    // Index might already exist, ignore error
    console.warn('Could not create idx_trades_market_price_time:', error?.message || error);
  }

  // Set up compression policy for trades (compress chunks older than 7 days)
  // This helps with storage and query performance for historical data
  // Use a savepoint to handle errors without aborting the transaction
  try {
    await sql`SAVEPOINT compression_policy`.execute(db);
    
    // Check if compression is enabled and policy doesn't already exist
    const compressionCheck = await sql<{ policy_exists: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM timescaledb_information.jobs
        WHERE proc_name = 'policy_compression'
        AND hypertable_name = 'trades'
        AND hypertable_schema = 'public'
      ) AS policy_exists
    `.execute(db);
    
    const policyExists = compressionCheck.rows[0]?.policy_exists;
    
    if (!policyExists) {
      await sql`
        SELECT add_compression_policy('trades', INTERVAL '7 days', if_not_exists => TRUE)
      `.execute(db);
    }
    
    await sql`RELEASE SAVEPOINT compression_policy`.execute(db);
  } catch (error: any) {
    // Rollback to savepoint to continue transaction
    try {
      await sql`ROLLBACK TO SAVEPOINT compression_policy`.execute(db);
    } catch {
      // Savepoint might not exist, ignore
    }
    // Ignore if policy already exists, compression not available, or other errors
    // Compression might not be enabled in all TimescaleDB installations
    console.warn('Could not add compression policy for trades:', error?.message || error);
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove compression policy for trades
  try {
    await sql`SAVEPOINT remove_compression_policy`.execute(db);
    
    // Check if compression policy exists before trying to remove it
    const compressionCheck = await sql<{ policy_exists: boolean }>`
      SELECT EXISTS (
        SELECT 1
        FROM timescaledb_information.jobs
        WHERE proc_name = 'policy_compression'
        AND hypertable_name = 'trades'
        AND hypertable_schema = 'public'
      ) AS policy_exists
    `.execute(db);
    
    const policyExists = compressionCheck.rows[0]?.policy_exists;
    
    if (policyExists) {
      await sql`
        SELECT remove_compression_policy('trades', if_exists => TRUE)
      `.execute(db);
    }
    
    await sql`RELEASE SAVEPOINT remove_compression_policy`.execute(db);
  } catch (error: any) {
    // Rollback to savepoint to continue transaction
    try {
      await sql`ROLLBACK TO SAVEPOINT remove_compression_policy`.execute(db);
    } catch {
      // Savepoint might not exist, ignore
    }
    // Ignore if policy doesn't exist or other errors
    console.warn('Could not remove compression policy for trades:', error?.message || error);
  }

  // Drop additional indexes created for time-series queries
  await db.schema.dropIndex('idx_trades_market_time_bucket').ifExists().execute();
  await db.schema.dropIndex('idx_trades_market_price_time').ifExists().execute();

  // Convert hypertable back to regular table
  // Note: This will require dropping and recreating the table, which is destructive
  // In a real scenario, you might want to export data first
  try {
    await sql`SAVEPOINT drop_chunks`.execute(db);
    
    // Check if chunks exist before trying to drop them
    const chunksCheck = await sql<{ chunk_count: string }>`
      SELECT COUNT(*)::text as chunk_count
      FROM timescaledb_information.chunks
      WHERE hypertable_name = 'trades'
      AND hypertable_schema = 'public'
    `.execute(db);
    
    const chunkCount = parseInt(chunksCheck.rows[0]?.chunk_count || '0', 10);
    
    if (chunkCount > 0) {
      await sql`
        SELECT drop_chunks('trades', INTERVAL '0 days', cascade => FALSE)
      `.execute(db);
    }
    
    await sql`RELEASE SAVEPOINT drop_chunks`.execute(db);
  } catch (error: any) {
    // Rollback to savepoint to continue transaction
    try {
      await sql`ROLLBACK TO SAVEPOINT drop_chunks`.execute(db);
    } catch {
      // Savepoint might not exist, ignore
    }
    // Ignore if no chunks exist or other errors
    console.warn('Could not drop chunks for trades:', error?.message || error);
  }
}

