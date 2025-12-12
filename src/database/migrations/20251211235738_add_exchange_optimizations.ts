import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Add additional indexes and constraints for better performance on orders table
  await db.schema.createIndex('idx_orders_book_query')
    .on('orders')
    .columns(['market_id', 'side', 'price', 'created_at'])
    .execute();
  
  await db.schema.createIndex('idx_orders_portfolio_history')
    .on('orders')
    .columns(['portfolio_id', 'created_at'])
    .execute();

  // Add additional indexes for trades table
  await db.schema.createIndex('idx_trades_history')
    .on('trades')
    .columns(['market_id', 'created_at', 'type'])
    .execute();
  
  await db.schema.createIndex('idx_trades_taker_history')
    .on('trades')
    .columns(['taker_user_id', 'created_at'])
    .execute();
  
  await db.schema.createIndex('idx_trades_maker_history')
    .on('trades')
    .columns(['maker_user_id', 'created_at'])
    .execute();
  
  await db.schema.createIndex('idx_trades_volume')
    .on('trades')
    .columns(['market_id', 'taker_side', 'created_at'])
    .execute();

  // Add additional indexes for markets table
  await db.schema.createIndex('idx_markets_active_category')
    .on('markets')
    .columns(['is_active', 'category'])
    .execute();
  
  await db.schema.createIndex('idx_markets_24h_active')
    .on('markets')
    .columns(['is_24h', 'is_active'])
    .execute();
  
  // Add unique constraint on symbol to prevent duplicates (if not already exists)
  await db.schema.createIndex('uq_markets_symbol')
    .on('markets')
    .column('symbol')
    .unique()
    .execute();

  // Create a view for order book aggregation (for performance)
  await sql`
    CREATE OR REPLACE VIEW order_book_view AS
    SELECT 
      market_id,
      side,
      price,
      SUM(quantity) as total_quantity,
      COUNT(*) as order_count,
      MIN(created_at) as first_order_time,
      MAX(created_at) as last_order_time
    FROM orders
    GROUP BY market_id, side, price
    ORDER BY market_id, side, 
      CASE WHEN side = 'bid' THEN price END DESC,
      CASE WHEN side = 'ask' THEN price END ASC
  `.execute(db);

  // Create a view for market statistics
  await sql`
    CREATE OR REPLACE VIEW market_stats_view AS
    SELECT 
      m.id as market_id,
      m.symbol,
      m.name,
      m.category,
      COUNT(DISTINCT o.id) as total_orders,
      COUNT(DISTINCT t.id) as total_trades,
      COALESCE(SUM(CASE WHEN t.created_at >= NOW() - INTERVAL '24 hours' THEN t.quantity * t.price END), 0) as volume_24h,
      COALESCE(MAX(CASE WHEN t.created_at >= NOW() - INTERVAL '24 hours' THEN t.price END), 0) as high_24h,
      COALESCE(MIN(CASE WHEN t.created_at >= NOW() - INTERVAL '24 hours' THEN t.price END), 0) as low_24h,
      (SELECT price FROM trades WHERE market_id = m.id ORDER BY created_at DESC LIMIT 1) as last_price
    FROM markets m
    LEFT JOIN orders o ON m.id = o.market_id
    LEFT JOIN trades t ON m.id = t.market_id
    WHERE m.is_active = true
    GROUP BY m.id, m.symbol, m.name, m.category
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop views
  await sql`DROP VIEW IF EXISTS market_stats_view`.execute(db);
  await sql`DROP VIEW IF EXISTS order_book_view`.execute(db);

  // Drop additional indexes
  await db.schema.dropIndex('idx_markets_active_category').execute();
  await db.schema.dropIndex('idx_markets_24h_active').execute();
  await db.schema.dropIndex('uq_markets_symbol').execute();

  await db.schema.dropIndex('idx_trades_history').execute();
  await db.schema.dropIndex('idx_trades_taker_history').execute();
  await db.schema.dropIndex('idx_trades_maker_history').execute();
  await db.schema.dropIndex('idx_trades_volume').execute();

  await db.schema.dropIndex('idx_orders_book_query').execute();
  await db.schema.dropIndex('idx_orders_portfolio_history').execute();
}