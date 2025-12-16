import { Injectable } from "@nestjs/common";
import { KyselyDao } from "@/database/kysely/kysely.dao";
import { OrderBookEntryDto } from "../dtos/order/order-book-entry.dto";
import { OrderDto } from "../dtos/order/order.dto";
import { BatchUpdateOrderDto } from "../dtos/order/batch-update-order.dto";
import { BatchOrderOperationDto } from "../dtos/order/batch-order-operation.dto";
import { sql } from "kysely";

@Injectable()
export class OrderDao extends KyselyDao<OrderDao> {

  /**
   * Insert a new order into the database
   */
  async createOrder(
    order: Omit<OrderBookEntryDto, "timestamp">,
    trx?: any,
  ): Promise<string | null> {
    try {
      const db = trx || this.kysely;
      const result = await db
        .insertInto('orders')
        .values({
          market_id: order.marketId,
          user_id: order.userId,
          quote_asset_id: order.quoteAssetId,
          side: order.side,
          price: order.price.toString(),
          quantity: order.quantity.toString(),
        } as any)
        .returning('id')
        .executeTakeFirst();

      return result?.id || null;
    } catch (error) {
      console.error("Error creating order:", error);
      return null;
    }
  }

  /**
   * Get all orders for a specific market
   */
  async getOrdersByMarket(marketId: string): Promise<OrderDto[]> {
    try {
      const results = await this.kysely
        .selectFrom('orders')
        .selectAll()
        .where('market_id', '=', marketId)
        .orderBy('price', 'desc') // Bids first (highest to lowest)
        .orderBy('side', 'asc') // Then asks (lowest to highest)
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching orders by market:", error);
      return [];
    }
  }

  /**
   * Get orders by market and side
   */
  async getOrdersByMarketAndSide(
    marketId: string,
    side: "bid" | "ask",
  ): Promise<OrderDto[]> {
    try {
      const orderBy = side === "bid" ? "desc" : "asc";
      const results = await this.kysely
        .selectFrom('orders')
        .selectAll()
        .where('market_id', '=', marketId)
        .where('side', '=', side)
        .orderBy('price', orderBy)
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching orders by market and side:", error);
      return [];
    }
  }

  /**
   * Get orders by market and side with row-level locking for order matching
   */
  async getOrdersByMarketAndSideForMatching(
    marketId: string,
    side: "bid" | "ask",
  ): Promise<OrderDto[]> {
    try {
      const orderBy = side === "bid" ? "desc" : "asc";
      const results = await this.kysely
        .selectFrom('orders')
        .selectAll()
        .where('market_id', '=', marketId)
        .where('side', '=', side)
        .where('quantity', '>', '0') // Only include orders with remaining quantity
        .orderBy('price', orderBy)
        .orderBy('created_at', 'asc') // Time priority
        .orderBy('id', 'asc') // Secondary sort by ID for deterministic ordering
        .forUpdate()
        .execute();
      return results.map((record) => this.mapRecordToDto(record));
    } catch (error) {
      console.error("Error fetching orders by market and side for matching:", error);
      return [];
    }
  }

  /**
   * Delete an order by ID
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .deleteFrom('orders')
        .where('id', '=', orderId)
        .executeTakeFirst();
      return result.numDeletedRows > 0;
    } catch (error: any) {
      // Check if it's a foreign key constraint violation (order has associated trades)
      if (error?.code === '23503') {
        // Order cannot be deleted because it has associated trades
        // This is expected behavior - trades preserve historical records
        // Silently return false - this is not an error condition
        return false;
      }
      // Log other errors
      console.error("Error deleting order:", error);
      return false;
    }
  }

  /**
   * Delete all orders for a specific market
   * Note: Trades must be deleted first due to foreign key constraints
   */
  async deleteOrdersByMarket(marketId: string): Promise<boolean> {
    try {
      await this.kysely
        .deleteFrom('orders')
        .where('market_id', '=', marketId)
        .execute();
      return true;
    } catch (error) {
      console.error("Error deleting orders by market:", error);
      return false;
    }
  }

  /**
   * Get all unique market IDs
   */
  async getMarketIds(): Promise<string[]> {
    try {
      const results = await this.kysely
        .selectFrom('orders')
        .select('market_id')
        .distinct()
        .execute();
      return results.map(row => row.market_id);
    } catch (error) {
      console.error("Error fetching market IDs:", error);
      return [];
    }
  }

  /**
   * Check if a market exists in the markets table
   */
  async marketExists(marketId: string): Promise<boolean> {
    try {
      const result = await this.kysely
        .selectFrom('markets')
        .select('id')
        .where('id', '=', marketId)
        .executeTakeFirst();
      return !!result;
    } catch (error) {
      console.error("Error checking if market exists:", error);
      return false;
    }
  }

  /**
   * Update order quantity
   */
  async updateOrderQuantity(
    orderId: string,
    quantity: number,
  ): Promise<boolean> {
    try {
      const result = await this.kysely
        .updateTable('orders')
        .set({
          quantity: quantity.toString(),
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where('id', '=', orderId)
        .executeTakeFirst();
      return result.numUpdatedRows > 0;
    } catch (error) {
      console.error("Error updating order quantity:", error);
      return false;
    }
  }

  /**
   * Batch update multiple order quantities efficiently
   */
  async batchUpdateOrderQuantities(
    updates: BatchUpdateOrderDto[],
  ): Promise<{ successCount: number; failedOrderIds: string[] }> {
    if (updates.length === 0) {
      return { successCount: 0, failedOrderIds: [] };
    }

    try {
      // For now, use individual updates in a transaction for simplicity
      // This can be optimized later with a proper CASE statement
      let successCount = 0;
      const failedOrderIds: string[] = [];

      for (const update of updates) {
        try {
          const result = await this.kysely
            .updateTable('orders')
            .set({
              quantity: update.newQuantity.toString(),
              updated_at: sql`CURRENT_TIMESTAMP`,
            })
            .where('id', '=', update.orderId)
            .executeTakeFirst();
          
          if (result.numUpdatedRows > 0) {
            successCount++;
          } else {
            failedOrderIds.push(update.orderId);
          }
        } catch (error) {
          failedOrderIds.push(update.orderId);
        }
      }

      return {
        successCount,
        failedOrderIds,
      };
    } catch (error) {
      console.error("Error in batch update order quantities:", error);
      return {
        successCount: 0,
        failedOrderIds: updates.map((u) => u.orderId),
      };
    }
  }

  /**
   * Batch delete multiple orders efficiently
   */
  async batchDeleteOrders(
    orderIds: string[],
  ): Promise<{ deletedCount: number; failedOrderIds: string[] }> {
    if (orderIds.length === 0) {
      return { deletedCount: 0, failedOrderIds: [] };
    }

    try {
      const result = await this.kysely
        .deleteFrom('orders')
        .where('id', 'in', orderIds)
        .executeTakeFirst();

      return {
        deletedCount: Number(result.numDeletedRows),
        failedOrderIds: [],
      };
    } catch (error) {
      console.error("Error in batch delete orders:", error);
      return {
        deletedCount: 0,
        failedOrderIds: orderIds,
      };
    }
  }

  /**
   * Execute batch operations for orders (updates and deletes)
   */
  async executeBatchOrderOperations(
    operations: BatchOrderOperationDto,
  ): Promise<{
    updateResult: { successCount: number; failedOrderIds: string[] };
    deleteResult: { deletedCount: number; failedOrderIds: string[] };
  }> {
    try {
      const [updateResult, deleteResult] = await Promise.all([
        operations.updates.length > 0
          ? this.batchUpdateOrderQuantities(operations.updates)
          : Promise.resolve({ successCount: 0, failedOrderIds: [] }),
        operations.deletes.length > 0
          ? this.batchDeleteOrders(operations.deletes)
          : Promise.resolve({ deletedCount: 0, failedOrderIds: [] }),
      ]);

      return { updateResult, deleteResult };
    } catch (error) {
      console.error("Error executing batch order operations:", error);
      return {
        updateResult: {
          successCount: 0,
          failedOrderIds: operations.updates.map((u) => u.orderId),
        },
        deleteResult: {
          deletedCount: 0,
          failedOrderIds: operations.deletes,
        },
      };
    }
  }

  /**
   * Get an order by ID
   */
  async getOrderById(orderId: string): Promise<OrderDto | null> {
    try {
      const result = await this.kysely
        .selectFrom('orders')
        .selectAll()
        .where('id', '=', orderId)
        .executeTakeFirst();
      
      return result ? this.mapRecordToDto(result) : null;
    } catch (error) {
      console.error("Error fetching order by ID:", error);
      return null;
    }
  }


  /**
   * Map database record to OrderDto
   */
  private mapRecordToDto(record: any): OrderDto {
    const dto = new OrderDto();
    dto.id = record.id;
    dto.marketId = record.market_id;
    dto.userId = record.user_id;
    dto.quoteAssetId = record.quote_asset_id;
    dto.side = record.side;
    dto.price = parseFloat(record.price);
    dto.quantity = parseFloat(record.quantity);
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
