import { Injectable } from "@nestjs/common";
import { KnexDao } from "@/database/knex/knex.dao";
import { OrderBookEntryDto } from "../dtos/order-book/order-book-entry.dto";

export interface OrderRecord {
  id: string;
  market_id: string;
  side: "bid" | "ask";
  price: string; // Decimal as string from database
  quantity: string; // Decimal as string from database
  created_at: Date;
  updated_at: Date;
}

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
  async getOrdersByMarket(marketId: string): Promise<OrderRecord[]> {
    try {
      return await this.knex(this.tableName)
        .where("market_id", marketId)
        .orderBy("price", "desc") // Bids first (highest to lowest)
        .orderBy("side", "asc"); // Then asks (lowest to highest)
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
  ): Promise<OrderRecord[]> {
    try {
      const orderBy = side === "bid" ? "desc" : "asc";
      return await this.knex(this.tableName)
        .where("market_id", marketId)
        .where("side", side)
        .orderBy("price", orderBy);
    } catch (error) {
      console.error("Error fetching orders by market and side:", error);
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
}
