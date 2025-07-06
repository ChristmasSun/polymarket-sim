'use client';

import { useState } from 'react';
import { Order } from '../types/orders';
import { PolymarketMarket } from '../types/polymarket';

interface OrdersModalProps {
  orders: Order[];
  isOpen: boolean;
  onClose: () => void;
  onSellOrder?: (orderId: string, currentPrice: number, markets: PolymarketMarket[], shares: number) => Promise<any>;
  markets?: PolymarketMarket[];
  title?: string;
  historyMode?: boolean;
}

export default function OrdersModal({ orders, isOpen, onClose, onSellOrder, markets, title, historyMode }: OrdersModalProps) {
  const [sellingOrderId, setSellingOrderId] = useState<string | null>(null);
  const [sharesToSell, setSharesToSell] = useState<{ [orderId: string]: number }>({});
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  const getTotalPnl = () => {
    if (historyMode) {
      return orders.reduce((sum, order) => sum + (order.pnl || 0), 0);
    }
    return orders.filter(o => o.action === 'buy' && o.shares > 0).reduce((sum, order) => sum + (order.pnl || 0), 0);
  };

  const getTotalInvested = () => {
    if (historyMode) {
      return orders.reduce((sum, order) => sum + order.totalCost, 0);
    }
    return orders.filter(o => o.action === 'buy' && o.shares > 0).reduce((sum, order) => sum + order.totalCost, 0);
  };

  const getTotalCurrentValue = () => {
    if (historyMode) {
      return orders.reduce((sum, order) => sum + (order.currentValue || 0), 0);
    }
    return orders.filter(o => o.action === 'buy' && o.shares > 0).reduce((sum, order) => sum + (order.currentValue || 0), 0);
  };

  const handleSellOrder = async (order: Order) => {
    if (!onSellOrder || !markets) return;
    
    console.log('[DEBUG] Markets array length:', markets.length);
    console.log('[DEBUG] Markets array type:', typeof markets);
    if (markets.length === 0) {
      alert('No markets data available. Please refresh the page.');
      return;
    }
    
    let shares = sharesToSell[order.id];
    if (!shares || isNaN(shares) || shares < 1) shares = order.shares;
    try {
      setSellingOrderId(order.id);
      
      // Find current price for this order (use same logic as updatePnl)
      let foundMarket = markets.find(m => 
        m.id === order.marketId || 
        m.conditionId === order.marketId ||
        m.condition_id === order.marketId
      );
      
      // Fallback: if market not found by ID, try to find by question and outcome
      if (!foundMarket) {
        console.log('[DEBUG] Market not found by ID, trying fallback lookup by question and outcome');
        foundMarket = markets.find(m => 
          m.question === order.marketQuestion && 
          m.outcomes && m.outcomes.includes(order.outcome)
        );
        if (foundMarket) {
          console.log('[DEBUG] Found market via fallback lookup:', { id: foundMarket.id, conditionId: foundMarket.conditionId });
        }
      }
      
      // Final fallback: create a virtual market for the order if it's not found
      if (!foundMarket) {
        console.log('[DEBUG] Market not found in current data, creating virtual market for order');
        
        // Determine the final outcome based on the order's current price
        // If price is closer to 1.0, it was likely a Yes/winning outcome
        // If price is closer to 0.0, it was likely a No/losing outcome
        const currentPrice = order.currentPrice || order.price;
        const isLikelyWinner = currentPrice > 0.5;
        const finalPrice = isLikelyWinner ? 1.0 : 0.0;
        const resolvedOutcome = isLikelyWinner ? order.outcome : null;
        
        console.log('[DEBUG] Order price analysis:', { 
          currentPrice, 
          isLikelyWinner, 
          finalPrice, 
          resolvedOutcome: resolvedOutcome || 'No (losing outcome)' 
        });
        
        // Create a minimal market object for this order
        foundMarket = {
          id: order.marketId,
          conditionId: order.marketId,
          question: order.marketQuestion,
          outcomes: [order.outcome],
          outcomePrices: [finalPrice.toString()], // Use determined final price
          isExpired: true, // Assume expired if not in current data
          resolvedOutcome: resolvedOutcome,
          active: false,
          closed: true,
          archived: true
        } as any;
        console.log('[DEBUG] Created virtual market:', { 
          id: foundMarket!.id, 
          conditionId: foundMarket!.conditionId, 
          question: foundMarket!.question,
          finalPrice,
          resolvedOutcome
        });
      }
      
      // At this point, foundMarket should definitely be defined
      if (!foundMarket) {
        alert('Could not find or create market data for this order. Please refresh the page and try again.');
        return;
      }
      
      const market = foundMarket;
      
      console.log('[DEBUG] Selling order:', { orderId: order.id, marketId: order.marketId, outcome: order.outcome });
      console.log('[DEBUG] Available markets (first 3):', markets.slice(0, 3).map(m => ({ id: m.id, conditionId: m.conditionId, condition_id: m.condition_id })));
      console.log('[DEBUG] Looking for marketId:', order.marketId);
      console.log('[DEBUG] MarketId type:', typeof order.marketId);
      console.log('[DEBUG] MarketId length:', order.marketId.length);
      
      // Check for exact matches
      const exactConditionIdMatch = markets.filter(m => m.conditionId === order.marketId);
      const exactIdMatch = markets.filter(m => m.id === order.marketId);
      const exactCondition_idMatch = markets.filter(m => m.condition_id === order.marketId);
      
      console.log('[DEBUG] Exact conditionId matches:', exactConditionIdMatch.length);
      console.log('[DEBUG] Exact id matches:', exactIdMatch.length);
      console.log('[DEBUG] Exact condition_id matches:', exactCondition_idMatch.length);
      
      // Check for partial matches (in case there's a prefix/suffix issue)
      const partialConditionIdMatches = markets.filter(m => m.conditionId && m.conditionId.includes(order.marketId));
      const partialIdMatches = markets.filter(m => m.id && m.id.includes(order.marketId));
      
      console.log('[DEBUG] Partial conditionId matches:', partialConditionIdMatches.length);
      console.log('[DEBUG] Partial id matches:', partialIdMatches.length);
      
      if (partialConditionIdMatches.length > 0) {
        console.log('[DEBUG] Partial conditionId matches:', partialConditionIdMatches.slice(0, 3).map(m => ({ id: m.id, conditionId: m.conditionId })));
      }
      console.log('[DEBUG] Found market:', { id: market.id, conditionId: market.conditionId, isExpired: market.isExpired, resolvedOutcome: market.resolvedOutcome });
      
              if (!market!.outcomes) {
          alert('Could not find current price for this order');
          return;
        }
        
        const outcomeIndex = market!.outcomes.indexOf(order.outcome);
        if (outcomeIndex === -1) {
          alert('Could not find current price for this outcome');
          return;
        }
        
        let currentPrice: number;
        
        // For expired markets, use the final outcome prices
        if (market!.isExpired) {
          if (market!.resolvedOutcome) {
            // If this outcome won, price is 1.0, otherwise 0.0
            currentPrice = order.outcome === market!.resolvedOutcome ? 1.0 : 0.0;
            console.log('[DEBUG] Using resolved market price:', { outcome: order.outcome, resolvedOutcome: market!.resolvedOutcome, price: currentPrice });
          } else {
            // Market is expired but not yet resolved - use current prices if available, otherwise use 0.0 as fallback
            if (market!.outcomePrices && market!.outcomePrices[outcomeIndex]) {
              currentPrice = parseFloat(market!.outcomePrices[outcomeIndex]);
              console.log('[DEBUG] Using current price for expired market:', currentPrice);
            } else {
              currentPrice = 0.0; // Fallback for expired markets without resolution
              console.log('[DEBUG] Using fallback price for expired market:', currentPrice);
            }
          }
        } else {
          // For active markets, use the current market price
          if (!market!.outcomePrices || !market!.outcomePrices[outcomeIndex]) {
            alert('Could not find current price for this order');
            return;
          }
          currentPrice = parseFloat(market!.outcomePrices[outcomeIndex]);
          console.log('[DEBUG] Using active market price:', currentPrice);
        }
      
      // Confirm the sale
      const pnl = ((currentPrice - order.price) * shares);
      const confirmed = window.confirm(
        `Sell ${shares} shares of "${order.outcome}" at current price $${currentPrice.toFixed(3)}?\n\n` +
        `Buy Price: $${order.price.toFixed(3)}\n` +
        `Current Price: $${currentPrice.toFixed(3)}\n` +
        `P&L: $${isNaN(pnl) ? '0.00' : pnl.toFixed(2)}`
      );
      
      if (!confirmed) return;
      
      const result = await onSellOrder(order.id, currentPrice, markets, shares);
      if (result.success) {
        alert(result.message.replace('undefined', shares.toString()).replace('NaN', '0.00'));
      }
    } catch (error) {
      console.error('Error selling order:', error);
      alert('Failed to sell order: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSellingOrderId(null);
    }
  };

  const displayOrders = historyMode
    ? orders // all orders, most recent first (should be sorted by parent)
    : orders.filter(order => order.action === 'buy' && order.shares > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">{title || (onSellOrder ? 'Order History' : 'Order History')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary */}
        <div className="p-6 border-b border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Total Orders</div>
              <div className="text-white text-2xl font-bold">{displayOrders.length}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Total Invested</div>
              <div className="text-white text-2xl font-bold">${getTotalInvested().toFixed(2)}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Current Value</div>
              <div className="text-white text-2xl font-bold">${getTotalCurrentValue().toFixed(2)}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Total P&L</div>
              <div className={`text-2xl font-bold ${getTotalPnl() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${getTotalPnl().toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="overflow-y-auto max-h-[60vh]">
          {displayOrders.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              {historyMode ? 'No order history yet.' : 'No open positions. Place your first trade to see it here!'}
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {displayOrders.map((order) => (
                <div key={order.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-semibold text-lg mb-1">
                        {order.marketQuestion}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {order.outcome} • {order.action.toUpperCase()} • {formatDate(order.timestamp)}
                      </p>
                      {/* Show if this is from a resolved market */}
                      {markets && (() => {
                        const market = markets.find(m => m.conditionId === order.marketId || m.id === order.marketId);
                        if (market?.isExpired && market?.resolvedOutcome) {
                          const isWinner = order.outcome === market.resolvedOutcome;
                          return (
                            <p className={`text-sm ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                              {isWinner ? '✓ Won' : '✗ Lost'} • Market resolved
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        order.action === 'buy' 
                          ? 'bg-green-900 text-green-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {order.action.toUpperCase()}
                      </div>
                      {order.action === 'buy' && onSellOrder && (
                        <>
                          <input
                            type="number"
                            min={1}
                            max={order.shares}
                            value={sharesToSell[order.id] === undefined ? order.shares : sharesToSell[order.id] === 0 ? '' : sharesToSell[order.id]}
                            onChange={e => {
                              const val = e.target.value;
                              if (val === '' || val === '0') {
                                setSharesToSell(s => ({ ...s, [order.id]: 0 }));
                              } else {
                                const num = parseInt(val);
                                if (!isNaN(num) && num > 0 && num <= order.shares) {
                                  setSharesToSell(s => ({ ...s, [order.id]: num }));
                                }
                              }
                            }}
                            className="w-20 px-2 py-1 rounded-xl border border-gray-600 bg-gray-700 text-white text-sm mr-2"
                            style={{ width: 60 }}
                            aria-label="Shares to sell"
                          />
                          <button
                            onClick={() => handleSellOrder(order)}
                            disabled={sellingOrderId === order.id || !sharesToSell[order.id] || sharesToSell[order.id] < 1 || sharesToSell[order.id] > order.shares}
                            className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-medium hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                          >
                            {sellingOrderId === order.id ? 'Selling...' : 'Sell'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-gray-400 text-sm">Shares</div>
                      <div className="text-white font-semibold">{order.shares}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm">Entry Price</div>
                      <div className="text-white font-semibold">${order.price.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm">Total Cost</div>
                      <div className="text-white font-semibold">${order.totalCost ? order.totalCost.toFixed(2) : '0.00'}</div>
                    </div>
                  </div>

                  {order.currentPrice !== undefined && (
                    <div className="border-t border-gray-700 pt-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm">Current Price</div>
                          <div className="text-white font-semibold">${order.currentPrice !== undefined ? order.currentPrice.toFixed(3) : (order.action === 'sell' ? order.price.toFixed(3) : '')}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm">Current Value</div>
                          <div className="text-white font-semibold">${order.currentValue !== undefined ? order.currentValue.toFixed(2) : (order.action === 'sell' ? (order.shares * order.price).toFixed(2) : '')}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm">P&L</div>
                          <div className={`font-semibold ${order.pnl && order.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>${order.action === 'sell' ? order.pnl?.toFixed(2) : order.pnl?.toFixed(2)}{order.action === 'sell' ? ' (locked)' : ` (${order.pnlPercentage?.toFixed(1)}%)`}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 