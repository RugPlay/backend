import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Enable TimescaleDB extension if not already enabled
  await sql`CREATE EXTENSION IF NOT EXISTS timescaledb`.execute(db);

  // Convert trades table to hypertable
  // Using created_at as the time column for partitioning
  await sql`
    SELECT create_hypertable(
      'trades',
      'created_at',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db);

  // Convert orders table to hypertable
  // Using created_at as the time column for partitioning
  await sql`
    SELECT create_hypertable(
      'orders',
      'created_at',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db);

  // Convert holdings table to hypertable
  // Using created_at as the time column for partitioning
  await sql`
    SELECT create_hypertable(
      'holdings',
      'created_at',
      chunk_time_interval => INTERVAL '1 day',
      if_not_exists => TRUE
    )
  `.execute(db);

  // Create additional indexes optimized for time-series queries
  // Composite index for market + time range queries on trades
  await db.schema
    .createIndex('idx_trades_market_time_bucket')
    .on('trades')
    .columns(['market_id', 'created_at'])
    .execute();

  // Composite index for market + time range queries on orders
  await db.schema
    .createIndex('idx_orders_market_time_bucket')
    .on('orders')
    .columns(['market_id', 'created_at'])
    .execute();

  // Index for price queries on trades (for OHLC calculations)
  await db.schema
    .createIndex('idx_trades_market_price_time')
    .on('trades')
    .columns(['market_id', 'price', 'created_at'])
    .execute();

  // Composite index for user + time range queries on holdings
  await db.schema
    .createIndex('idx_holdings_user_time_bucket')
    .on('holdings')
    .columns(['user_id', 'created_at'])
    .execute();

  // Composite index for asset + time range queries on holdings
  await db.schema
    .createIndex('idx_holdings_asset_time_bucket')
    .on('holdings')
    .columns(['asset_id', 'created_at'])
    .execute();

  // Set up compression policy for trades (compress chunks older than 7 days)
  // This helps with storage and query performance for historical data
  await sql`
    SELECT add_compression_policy('trades', INTERVAL '7 days', if_not_exists => TRUE)
  `.execute(db).catch(() => {
    // Ignore if policy already exists or compression not available
  });

  // Set up compression policy for orders (compress chunks older than 7 days)
  await sql`
    SELECT add_compression_policy('orders', INTERVAL '7 days', if_not_exists => TRUE)
  `.execute(db).catch(() => {
    // Ignore if policy already exists or compression not available
  });

  // Set up compression policy for holdings (compress chunks older than 7 days)
  await sql`
    SELECT add_compression_policy('holdings', INTERVAL '7 days', if_not_exists => TRUE)
  `.execute(db).catch(() => {
    // Ignore if policy already exists or compression not available
  });
}

export async function down(db: Kysely<any>): Promise<void> {
  // Remove compression policies first
  await sql`
    SELECT remove_compression_policy('trades', if_exists => TRUE)
  `.execute(db).catch(() => {
    // Ignore if policy doesn't exist
  });

  await sql`
    SELECT remove_compression_policy('orders', if_exists => TRUE)
  `.execute(db).catch(() => {
    // Ignore if policy doesn't exist
  });

  await sql`
    SELECT remove_compression_policy('holdings', if_exists => TRUE)
  `.execute(db).catch(() => {
    // Ignore if policy doesn't exist
  });

  // Drop additional indexes
  await db.schema.dropIndex('idx_trades_market_time_bucket').ifExists().execute();
  await db.schema.dropIndex('idx_orders_market_time_bucket').ifExists().execute();
  await db.schema.dropIndex('idx_trades_market_price_time').ifExists().execute();
  await db.schema.dropIndex('idx_holdings_user_time_bucket').ifExists().execute();
  await db.schema.dropIndex('idx_holdings_asset_time_bucket').ifExists().execute();

  // Convert hypertables back to regular tables
  // Note: This will require dropping and recreating the tables, which is destructive
  // In a real scenario, you might want to export data first
  await sql`
    SELECT drop_chunks('trades', INTERVAL '0 days', cascade => FALSE)
  `.execute(db).catch(() => {
    // Ignore if no chunks exist
  });

  await sql`
    SELECT drop_chunks('orders', INTERVAL '0 days', cascade => FALSE)
  `.execute(db).catch(() => {
    // Ignore if no chunks exist
  });

  await sql`
    SELECT drop_chunks('holdings', INTERVAL '0 days', cascade => FALSE)
  `.execute(db).catch(() => {
    // Ignore if no chunks exist
  });
}

