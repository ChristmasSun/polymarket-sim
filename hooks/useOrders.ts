import { useState, useEffect, useCallback } from 'react';
import { Order, OrderBook } from '../types/orders';
import { PolymarketMarket } from '../types/polymarket';

export interface OrderSummary {
  totalOrders: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
  totalSellProceeds: number;
}

const STORAGE_KEY = 'polymarket-orders';
const STARTING_BALANCE = 10000;

// Helper functions for localStorage
const getOrdersFromStorage = (): OrderBook => {
  if (typeof window === 'undefined') {
    return { orders: [], lastUpdated: new Date().toISOString() };
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error reading from localStorage:', error);
  }
  
  return { orders: [], lastUpdated: new Date().toISOString() };
};

const saveOrdersToStorage = (orderBook: OrderBook) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderBook));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary>({
    totalOrders: 0,
    totalInvested: 0,
    totalCurrentValue: 0,
    totalPnl: 0,
    totalPnlPercentage: 0,
    totalSellProceeds: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load orders from localStorage
  const loadOrders = useCallback(() => {
    try {
      setLoading(true);
      const orderBook = getOrdersFromStorage();
      setOrders(orderBook.orders);
      // Calculate initial summary (only count buys for invested)
      const totalInvested = orderBook.orders.filter(o => o.action === 'buy').reduce((sum, order) => sum + order.totalCost, 0);
      const totalCurrentValue = orderBook.orders.filter(o => o.action === 'buy').reduce((sum, order) => sum + (order.currentValue || 0), 0);
      const totalPnl = totalCurrentValue - totalInvested;
      const totalPnlPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
      setSummary({
        totalOrders: orderBook.orders.filter(o => o.action === 'buy' && o.shares > 0).length,
        totalInvested,
        totalCurrentValue,
        totalPnl,
        totalPnlPercentage,
        totalSellProceeds: 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Place a new order
  const placeOrder = useCallback((
    marketId: string,
    marketQuestion: string,
    outcome: string,
    action: 'buy' | 'sell',
    shares: number,
    price: number
  ) => {
    try {
      setLoading(true);
      
      const orderBook = getOrdersFromStorage();
      const totalInvested = orderBook.orders.reduce((sum, order) => sum + order.totalCost, 0);
      const currentBalance = STARTING_BALANCE - totalInvested;
      const totalCost = shares * price;
      
      // Validate buy orders
      if (action === 'buy') {
        if (totalCost > currentBalance) {
          const error = `Insufficient balance! You have $${currentBalance.toFixed(2)} but need $${totalCost.toFixed(2)} for this trade.`;
          setError(error);
          throw new Error(error);
        }
      }
      
      // Validate sell orders
      if (action === 'sell') {
        const currentPosition = orderBook.orders
          .filter(order => order.marketId === marketId && order.outcome === outcome)
          .reduce((net, order) => {
            if (order.action === 'buy') {
              return net + order.shares;
            } else {
              return net - order.shares;
            }
          }, 0);
        
        if (currentPosition < shares) {
          const error = `Insufficient shares! You have ${currentPosition} shares but trying to sell ${shares}.`;
          setError(error);
          throw new Error(error);
        }
      }
      
      const newOrder: Order = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        marketId,
        marketQuestion,
        outcome,
        action,
        shares,
        price,
        totalCost: shares * price,
        timestamp: new Date().toISOString(),
        currentPrice: price, // Set initial current price to the purchase price
        currentValue: shares * price, // Set initial current value
        pnl: 0, // No P&L initially since we just bought
        pnlPercentage: 0 // No P&L percentage initially
      };
      
      orderBook.orders.push(newOrder);
      orderBook.lastUpdated = new Date().toISOString();
      
      saveOrdersToStorage(orderBook);
      // Always reload from storage to ensure state is up to date
      const freshOrderBook = getOrdersFromStorage();
      setOrders(freshOrderBook.orders);
      
      // Update summary
      const newTotalInvested = freshOrderBook.orders.filter(o => o.action === 'buy').reduce((sum, order) => sum + order.totalCost, 0);
      const newTotalCurrentValue = freshOrderBook.orders.filter(o => o.action === 'buy').reduce((sum, order) => sum + (order.currentValue || 0), 0);
      const newTotalPnl = newTotalCurrentValue - newTotalInvested;
      const newTotalPnlPercentage = newTotalInvested > 0 ? (newTotalPnl / newTotalInvested) * 100 : 0;
      
      setSummary({
        totalOrders: freshOrderBook.orders.filter(o => o.action === 'buy' && o.shares > 0).length,
        totalInvested: newTotalInvested,
        totalCurrentValue: newTotalCurrentValue,
        totalPnl: newTotalPnl,
        totalPnlPercentage: newTotalPnlPercentage,
        totalSellProceeds: 0
      });
      
      return {
        success: true,
        order: newOrder,
        message: `Order placed: ${action} ${shares} shares of "${outcome}" at $${price.toFixed(3)}`
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to place order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Sell an existing order at current market price
  const sellOrder = useCallback((
    orderId: string,
    currentPrice: number,
    markets: PolymarketMarket[],
    sharesToSell: number
  ) => {
    try {
      setLoading(true);
      const orderBook = getOrdersFromStorage();
      const orderIndex = orderBook.orders.findIndex(order => order.id === orderId);
      if (orderIndex === -1) {
        throw new Error('Order not found');
      }
      const order = orderBook.orders[orderIndex];
      if (sharesToSell > order.shares) {
        throw new Error('Cannot sell more shares than owned');
      }
      // Calculate proportional cost for partial sell
      const costPerShare = order.totalCost / order.shares;
      const sellCost = costPerShare * sharesToSell;
      const currentValue = sharesToSell * currentPrice;
      const pnl = currentValue - sellCost;
      const pnlPercentage = sellCost > 0 ? (pnl / sellCost) * 100 : 0;
      // Create sell order
      const sellOrder: Order = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        marketId: order.marketId,
        marketQuestion: order.marketQuestion,
        outcome: order.outcome,
        action: 'sell',
        shares: sharesToSell,
        price: currentPrice,
        totalCost: currentValue, // Proceeds from sale
        timestamp: new Date().toISOString(),
        currentPrice,
        currentValue,
        pnl,
        pnlPercentage
      };
      orderBook.orders.push(sellOrder);
      // Update or remove the original buy order
      if (sharesToSell === order.shares) {
        // Remove the buy order if all shares sold
        orderBook.orders.splice(orderIndex, 1);
      } else {
        // Reduce the buy order's shares and totalCost by the cost basis of shares sold
        orderBook.orders[orderIndex] = {
          ...order,
          shares: order.shares - sharesToSell,
          totalCost: order.totalCost - sellCost
        };
      }
      orderBook.lastUpdated = new Date().toISOString();
      saveOrdersToStorage(orderBook);
      // Always reload from storage to ensure state is up to date
      const freshOrderBook = getOrdersFromStorage();
      setOrders(freshOrderBook.orders);
      // Update summary
      // Only count open buy orders for invested/current value, and add up all sell proceeds for available balance
      const openBuys = freshOrderBook.orders.filter(o => o.action === 'buy' && o.shares > 0);
      const totalInvested = openBuys.reduce((sum, order) => sum + order.totalCost, 0);
      const totalCurrentValue = openBuys.reduce((sum, order) => sum + (order.currentValue || 0), 0);
      const totalSellProceeds = freshOrderBook.orders.filter(o => o.action === 'sell').reduce((sum, order) => sum + order.totalCost, 0);
      const totalPnl = totalCurrentValue - totalInvested;
      const totalPnlPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
      setSummary({
        totalOrders: openBuys.length,
        totalInvested,
        totalCurrentValue,
        totalPnl,
        totalPnlPercentage,
        totalSellProceeds
      });
      return {
        success: true,
        order: sellOrder,
        message: `Sold ${sharesToSell} shares of "${order.outcome}" at $${currentPrice.toFixed(3)} for a ${pnl >= 0 ? 'profit' : 'loss'} of $${Math.abs(pnl).toFixed(2)}`
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sell order';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update P&L calculations based on current market prices
  const updatePnl = useCallback((markets: PolymarketMarket[]) => {
    try {
      // Always reload latest orders from storage
      const orderBook = getOrdersFromStorage();
      let updated = false;
      const updatedOrders = orderBook.orders.map(order => {
        // Only update open buy orders
        if (order.action === 'buy' && order.shares > 0) {
          const market = markets.find(m => 
            m.id === order.marketId || 
            m.conditionId === order.marketId ||
            m.condition_id === order.marketId
          );
          if (market) {
            const outcomeIndex = market.outcomes.findIndex(o => o === order.outcome);
            if (outcomeIndex !== -1 && market.outcomePrices && market.outcomePrices[outcomeIndex]) {
              const currentPrice = parseFloat(market.outcomePrices[outcomeIndex]);
              updated = true;
              const currentValue = order.shares * currentPrice;
              const pnl = currentValue - order.totalCost;
              const pnlPercentage = order.totalCost > 0 ? (pnl / order.totalCost) * 100 : 0;
              return {
                ...order,
                currentPrice,
                currentValue,
                pnl,
                pnlPercentage
              };
            }
          }
        }
        // For sell orders or closed buys, do not update
        return order;
      });
      if (updated) {
        orderBook.orders = updatedOrders;
        orderBook.lastUpdated = new Date().toISOString();
        saveOrdersToStorage(orderBook);
      }
      // Always reload from storage to ensure state is up to date
      const freshOrderBook = getOrdersFromStorage();
      setOrders(freshOrderBook.orders);
      // Update summary from latest orders
      const openBuys = freshOrderBook.orders.filter(o => o.action === 'buy' && o.shares > 0);
      const totalInvested = openBuys.reduce((sum, order) => sum + order.totalCost, 0);
      const totalCurrentValue = openBuys.reduce((sum, order) => sum + (order.currentValue || 0), 0);
      const totalSellProceeds = freshOrderBook.orders.filter(o => o.action === 'sell').reduce((sum, order) => sum + order.totalCost, 0);
      const totalPnl = totalCurrentValue - totalInvested;
      const totalPnlPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
      setSummary({
        totalOrders: openBuys.length,
        totalInvested,
        totalCurrentValue,
        totalPnl,
        totalPnlPercentage,
        totalSellProceeds
      });
      return {
        success: true,
        orderBook: { ...freshOrderBook, orders: openBuys },
        summary: {
          totalOrders: openBuys.length,
          totalInvested,
          totalCurrentValue,
          totalPnl,
          totalPnlPercentage,
          totalSellProceeds
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update P&L');
    }
  }, []);

  // Get orders for a specific market
  const getMarketOrders = useCallback((marketId: string) => {
    return orders.filter(order => order.marketId === marketId);
  }, [orders]);

  // Get orders for a specific market outcome
  const getOutcomeOrders = useCallback((marketId: string, outcome: string) => {
    return orders.filter(order => order.marketId === marketId && order.outcome === outcome);
  }, [orders]);

  // Calculate net position for a market outcome
  const getNetPosition = useCallback((marketId: string, outcome: string) => {
    // Only sum open buy orders (shares > 0)
    const outcomeOrders = getOutcomeOrders(marketId, outcome);
    return outcomeOrders
      .filter(order => order.action === 'buy' && order.shares > 0)
      .reduce((net, order) => net + order.shares, 0);
  }, [getOutcomeOrders]);

  // Load orders on mount (only once)
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return {
    orders,
    summary,
    loading,
    error,
    placeOrder,
    sellOrder,
    updatePnl,
    getMarketOrders,
    getOutcomeOrders,
    getNetPosition,
    loadOrders
  };
} 