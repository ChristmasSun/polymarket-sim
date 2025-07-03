'use client';

import { useState, useEffect } from 'react';
import MarketCard from '../components/MarketCard';
import OrdersModal from '../components/OrdersModal';
import { useOrders } from '../hooks/useOrders';
import { PolymarketMarket } from '../types/polymarket';

export default function Home() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showOrderHistoryModal, setShowOrderHistoryModal] = useState(false);
  const [isUpdatingPnl, setIsUpdatingPnl] = useState(false);
  const { updatePnl, summary, orders, placeOrder, sellOrder } = useOrders();

  // Auto-refresh P&L every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (markets.length > 0 && orders.length > 0) {
        console.log('Auto-updating P&L...');
        updatePnl(markets);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [markets, orders, updatePnl]);

  // Starting balance - you can adjust this
  const STARTING_BALANCE = 10000; // $10,000 starting balance
  const currentBalance = STARTING_BALANCE - summary.totalInvested;
  const totalPortfolioValue = currentBalance + summary.totalCurrentValue;

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Add cache-busting timestamp
      const timestamp = Date.now();
      
      // Fetch markets with no-cache options
      const marketsResponse = await fetch(`/api/markets?limit=500&_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        }
      });

      if (!marketsResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const marketsData = await marketsResponse.json();
      
      // Sort markets by volume (highest to lowest)
      const sortedMarkets = (marketsData.markets || []).sort((a: any, b: any) => {
        const volumeA = parseFloat(a.volume || '0');
        const volumeB = parseFloat(b.volume || '0');
        return volumeB - volumeA;
      });

      setMarkets(sortedMarkets);
      setLastUpdated(new Date());
      
      // Update P&L calculations with current market prices
      updatePnl(sortedMarkets);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading fresh Polymarket data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">Error loading data</div>
          <p className="text-gray-300">{error}</p>
          <button 
            onClick={fetchData} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-white">Polymarket Simulator</h1>
              <p className="text-gray-300 mt-1">Real prediction markets from Polymarket</p>
              {lastUpdated && (
                <p className="text-sm text-gray-400 mt-1">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => {
                  fetchData();
                  // Also update P&L after fetching new data
                  setTimeout(() => {
                    if (markets.length > 0) {
                      updatePnl(markets);
                    }
                  }, 1000); // Wait 1 second for markets to load
                }}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Data & P&L</span>
              </button>
              

              
              {/* Orders Button */}
              <button
                onClick={() => setShowOrdersModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Orders ({orders.filter(order => order.action === 'buy' && order.shares > 0).length})</span>
              </button>
              
              {/* Order History Button */}
              <button
                onClick={() => setShowOrderHistoryModal(true)}
                className="px-4 py-2 bg-gray-600 text-white rounded-xl hover:bg-gray-700 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                </svg>
                <span>Order History</span>
              </button>
              
              {/* Reset Portfolio Button */}
              <button
                onClick={() => {
                  if (window.confirm('Warning: This will fully reset your portfolio and wipe all site data. Are you sure?')) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Reset Portfolio</span>
              </button>
              
              {/* Portfolio Summary */}
              <div className="bg-gray-700 rounded-xl p-4 min-w-[280px]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">Portfolio Summary</h3>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-400">Auto-updating</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Available Balance:</span>
                    <span className="text-white font-medium">${currentBalance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Invested:</span>
                    <span className="text-white font-medium">${summary.totalInvested.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Value:</span>
                    <span className="text-white font-medium">${summary.totalCurrentValue.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-gray-600 pt-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Portfolio:</span>
                      <span className="text-white font-bold">${totalPortfolioValue.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total P&L:</span>
                    <span className={`font-bold ${summary.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${summary.totalPnl.toFixed(2)} ({summary.totalPnlPercentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Markets Section */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-6">All Markets (Sorted by Volume)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard 
                key={market.id} 
                market={market}
                orders={orders}
                currentBalance={currentBalance}
                placeOrder={placeOrder}
                sellOrder={async (marketId, outcome, shares, price) => {
                  // Find the matching open buy order for this market/outcome
                  const openBuyOrder = orders.find(o => o.marketId === marketId && o.outcome === outcome && o.action === 'buy' && o.shares > 0);
                  if (!openBuyOrder) {
                    alert('No open buy order found for this outcome.');
                    return { success: false };
                  }
                  return await sellOrder(openBuyOrder.id, price, markets, shares);
                }}
                onOrderPlaced={() => {
                  // Refresh P&L data after order is placed (with debounce)
                  if (!isUpdatingPnl) {
                    setIsUpdatingPnl(true);
                    updatePnl(markets);
                    setIsUpdatingPnl(false);
                  }
                }}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Orders Modal */}
      <OrdersModal
        orders={orders}
        isOpen={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        onSellOrder={async (orderId, currentPrice, markets, shares) => {
          try {
            // Always use the same sell logic as MarketCard
            const result = await sellOrder(orderId, currentPrice, markets, shares);
            if (result.success) {
              if (!isUpdatingPnl) {
                setIsUpdatingPnl(true);
                await updatePnl(markets);
                setIsUpdatingPnl(false);
              }
            }
            return result;
          } catch (error) {
            console.error('Error in sell order callback:', error);
            throw error;
          }
        }}
        markets={markets}
        historyMode={false}
      />

      {/* Order History Modal (shows all orders, no sell actions) */}
      <OrdersModal
        orders={[...orders].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())}
        isOpen={showOrderHistoryModal}
        onClose={() => setShowOrderHistoryModal(false)}
        markets={markets}
        // No onSellOrder prop, disables sell actions
        title="Order History"
        historyMode={true}
      />
    </div>
  );
} 