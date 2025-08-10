import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { OrderBookEntryDto } from "../dtos/order/order-book-entry.dto";
import { OrderDto } from "../dtos/order/order.dto";
import { BatchUpdateOrderDto, BatchOrderOperationDto } from "../dtos/order/batch-update-order.dto";

@Injectable()
export class OrderDao extends KnexDao<OrderDao> {
  protected readonly tableName = "orders";

  /**
   * Insert a new order into the database
   */
  async createOrder(
    order: Omit<OrderBookEntryDto, "timestamp">,
  ): Promise<string | null> {
    try {
      const [result] = await this.knex(this.tableName)
        .insert({
          market_id: order.marketId,
          portfolio_id: order.portfolioId,
          side: order.side,
          price: order.price.toString(),
          quantity: order.quantity.toString(),
        })
        .returning("id");

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
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("price", "desc") // Bids first (highest to lowest)
        .orderBy("side", "asc"); // Then asks (lowest to highest)
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
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .where("side", side)
        .orderBy("price", orderBy);
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
      const results = await this.knex(this.tableName)
        .where("market_id", marketId)
        .where("side", side)
        .orderBy("price", orderBy)
        .orderBy("created_at", "asc") // Time priority
        .forUpdate(); // Row-level locking
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
      const deletedCount = await this.knex(this.tableName)
        .where("id", orderId)
        .delete();
      return deletedCount > 0;
    } catch (error) {
      console.error("Error deleting order:", error);
      return false;
    }
  }

  /**
   * Delete all orders for a specific market
   */
  async deleteOrdersByMarket(marketId: string): Promise<boolean> {
    try {
      await this.knex(this.tableName).where("market_id", marketId).delete();
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
      const results = await this.knex(this.tableName)
        .distinct("market_id")
        .pluck("market_id");
      return results;
    } catch (error) {
      console.error("Error fetching market IDs:", error);
      return [];
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
      const updatedCount = await this.knex(this.tableName)
        .where("id", orderId)
        .update({
          quantity: quantity.toString(),
          updated_at: this.knex.fn.now(),
        });
      return updatedCount > 0;
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
      const orderIds = updates.map((u) => u.orderId);
      const cases = updates
        .map((u) => `WHEN id = ? THEN ?`)
        .join(" ");

      // Flatten the parameters: [id1, quantity1, id2, quantity2, ...]
      const caseParams = updates.flatMap((u) => [u.orderId, u.newQuantity.toString()]);
      const whereParams = orderIds;

      const result = await this.knex.raw(
        `
        UPDATE ${this.tableName} 
        SET quantity = CASE ${cases} END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${orderIds.map(() => "?").join(",")})
        `,
        [...caseParams, ...whereParams],
      );

      return {
        successCount: result.rowCount || updates.length,
        failedOrderIds: [],
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
      const deletedCount = await this.knex(this.tableName)
        .whereIn("id", orderIds)
        .delete();

      return {
        deletedCount,
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
   * Map database record to OrderDto
   */
  private mapRecordToDto(record: any): OrderDto {
    const dto = new OrderDto();
    dto.id = record.id;
    dto.marketId = record.market_id;
    dto.portfolioId = record.portfolio_id;
    dto.side = record.side;
    dto.price = parseFloat(record.price);
    dto.quantity = parseFloat(record.quantity);
    dto.createdAt = record.created_at;
    dto.updatedAt = record.updated_at;
    return dto;
  }
}
