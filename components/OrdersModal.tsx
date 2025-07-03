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
    
    let shares = sharesToSell[order.id];
    if (!shares || isNaN(shares) || shares < 1) shares = order.shares;
    try {
      setSellingOrderId(order.id);
      
      // Find current price for this order
      const market = markets.find(m => m.conditionId === order.marketId || m.id === order.marketId);
      if (!market || !market.outcomes || !market.outcomePrices) {
        alert('Could not find current price for this order');
        return;
      }
      
      const outcomeIndex = market.outcomes.indexOf(order.outcome);
      if (outcomeIndex === -1) {
        alert('Could not find current price for this outcome');
        return;
      }
      
      const currentPrice = parseFloat(market.outcomePrices[outcomeIndex]);
      
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