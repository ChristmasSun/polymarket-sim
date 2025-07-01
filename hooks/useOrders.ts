import { useState, useEffect, useCallback } from 'react';
import { Order, OrderBook } from '../types/orders';
import { PolymarketMarket } from '../types/polymarket';

export interface OrderSummary {
  totalOrders: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary>({
    totalOrders: 0,
    totalInvested: 0,
    totalCurrentValue: 0,
    totalPnl: 0,
    totalPnlPercentage: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load orders from persistent storage
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error('Failed to load orders');
      
      const orderBook: OrderBook = await response.json();
      setOrders(orderBook.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Place a new order
  const placeOrder = useCallback(async (
    marketId: string,
    marketQuestion: string,
    outcome: string,
    action: 'buy' | 'sell',
    shares: number,
    price: number
  ) => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId,
          marketQuestion,
          outcome,
          action,
          shares,
          price
        })
      });

      if (!response.ok) throw new Error('Failed to place order');
      
      const result = await response.json();
      if (result.success) {
        // Reload orders to get the updated list
        await loadOrders();
        
        // Update summary immediately after placing order
        const updatedOrders = await fetch('/api/orders');
        if (updatedOrders.ok) {
          const orderBook: OrderBook = await updatedOrders.json();
          const totalInvested = orderBook.orders.reduce((sum, order) => sum + order.totalCost, 0);
          const totalOrders = orderBook.orders.length;
          
          // Update summary with new data (keeping current P&L values)
          setSummary(prev => ({
            ...prev,
            totalOrders,
            totalInvested
          }));
        }
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to place order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to place order');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadOrders]);

  // Sell an existing order at current market price
  const sellOrder = useCallback(async (
    orderId: string,
    currentPrice: number,
    markets: PolymarketMarket[]
  ) => {
    try {
      setLoading(true);
      const response = await fetch('/api/orders/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          currentPrice,
          markets
        })
      });

      if (!response.ok) throw new Error('Failed to sell order');
      
      const result = await response.json();
      if (result.success) {
        // Reload orders to get the updated list
        await loadOrders();
        
        // Update summary immediately after selling
        const updatedOrders = await fetch('/api/orders');
        if (updatedOrders.ok) {
          const orderBook: OrderBook = await updatedOrders.json();
          const totalInvested = orderBook.orders.reduce((sum, order) => sum + order.totalCost, 0);
          const totalOrders = orderBook.orders.length;
          
          // Update summary with new data (keeping current P&L values)
          setSummary(prev => ({
            ...prev,
            totalOrders,
            totalInvested
          }));
        }
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to sell order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sell order');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [loadOrders]);

  // Update P&L calculations based on current market prices
  const updatePnl = useCallback(async (markets: PolymarketMarket[]) => {
    try {
      const response = await fetch('/api/orders/pnl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markets })
      });

      if (!response.ok) throw new Error('Failed to update P&L');
      
      const result = await response.json();
      if (result.success) {
        setOrders(result.orderBook.orders);
        setSummary(result.summary);
        return result;
      } else {
        throw new Error(result.error || 'Failed to update P&L');
      }
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
    const outcomeOrders = getOutcomeOrders(marketId, outcome);
    return outcomeOrders.reduce((net, order) => {
      if (order.action === 'buy') {
        return net + order.shares;
      } else {
        return net - order.shares;
      }
    }, 0);
  }, [getOutcomeOrders]);

  // Load orders on mount (only once)
  useEffect(() => {
    loadOrders();
  }, []); // Empty dependency array - only run on mount

  return {
    orders,
    summary,
    loading,
    error,
    placeOrder,
    sellOrder,
    updatePnl,
    loadOrders,
    getMarketOrders,
    getOutcomeOrders,
    getNetPosition
  };
} 