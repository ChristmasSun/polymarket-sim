'use client';

import { useState } from 'react';
import { PolymarketMarket } from '../types/polymarket';
import { Order } from '../types/orders';

interface MarketCardProps {
  market: PolymarketMarket;
  onOrderPlaced?: () => void;
  orders: Order[];
  currentBalance: number;
  placeOrder: (marketId: string, marketQuestion: string, outcome: string, action: 'buy' | 'sell', shares: number, price: number) => any;
}

export default function MarketCard({ market, onOrderPlaced, orders, currentBalance, placeOrder }: MarketCardProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [shares, setShares] = useState<number>(1);
  const [action, setAction] = useState<'buy' | 'sell'>('buy');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Helper functions (previously from useOrders hook)
  const getNetPosition = (marketId: string, outcome: string) => {
    const outcomeOrders = orders.filter(order => order.marketId === marketId && order.outcome === outcome);
    return outcomeOrders.reduce((net, order) => {
      if (order.action === 'buy') {
        return net + order.shares;
      } else {
        return net - order.shares;
      }
    }, 0);
  };

  const getOutcomeOrders = (marketId: string, outcome: string) => {
    return orders.filter(order => order.marketId === marketId && order.outcome === outcome);
  };

  const handleTrade = () => {
    if (!selectedOutcome) return;

    const outcomeIndex = market.outcomes?.indexOf(selectedOutcome);
    if (outcomeIndex === -1 || !market.outcomePrices) return;

    const price = parseFloat(market.outcomePrices[outcomeIndex]);
    const marketId = market.conditionId || market.id;
    
    if (!marketId) {
      alert('Invalid market ID');
      return;
    }

    // Calculate total cost for this trade
    const totalCost = shares * price;

    // Validate balance for buy orders
    if (action === 'buy') {
      if (totalCost > currentBalance) {
        alert(`Insufficient balance! You have $${currentBalance.toFixed(2)} but need $${totalCost.toFixed(2)} for this trade.`);
        return;
      }
    }

    // Validate position for sell orders
    if (action === 'sell') {
      const currentPosition = getNetPosition(marketId, selectedOutcome);
      if (currentPosition < shares) {
        alert(`Insufficient shares! You have ${currentPosition} shares but trying to sell ${shares}.`);
        return;
      }
    }

    try {
      setIsPlacingOrder(true);
      placeOrder(
        marketId,
        market.question || 'Unknown Market',
        selectedOutcome,
        action,
        shares,
        price
      );
      
      // Reset form
      setSelectedOutcome('');
      setShares(1);
      
      // Show success feedback
      const button = document.querySelector(`[data-market="${marketId}"] button`);
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✓ Success!';
        button.classList.add('bg-green-600');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('bg-green-600');
        }, 2000);
      }
      
      // Notify parent component that an order was placed
      if (onOrderPlaced) {
        onOrderPlaced();
      }
    } catch (error) {
      console.error('Trade failed:', error);
      alert('Trade failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const getPosition = (outcome: string) => {
    const marketId = market.conditionId || market.id;
    return marketId ? getNetPosition(marketId, outcome) : 0;
  };

  const getOutcomeOrdersForDisplay = (outcome: string) => {
    const marketId = market.conditionId || market.id;
    return marketId ? getOutcomeOrders(marketId, outcome) : [];
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Calculate total probability from outcome prices
  const totalProbability = market.outcomePrices?.reduce((sum, price) => sum + parseFloat(price), 0) || 0;

  // Create outcome data array for easier mapping
  const outcomeData = market.outcomes?.map((outcome, index) => ({
    outcome,
    price: parseFloat(market.outcomePrices?.[index] || '0'),
    id: `${market.id}-${index}`
  })) || [];

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transition-shadow">
      {/* Market Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-white text-lg mb-2 line-clamp-2">
          {market.question || 'Unknown Market'}
        </h3>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Ends: {formatDate(market.endDateIso || market.end_date_iso || '')}</span>
          <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300">
            {outcomeData.length} outcomes
          </span>
        </div>
      </div>

      {/* Market Description */}
      {market.description && (
        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
          {market.description}
        </p>
      )}

      {/* Outcomes */}
      <div className="space-y-3 mb-6">
        {outcomeData.map((outcome) => {
          const position = getPosition(outcome.outcome);
          const probability = totalProbability > 0 ? (outcome.price / totalProbability * 100) : 0;
          const outcomeOrders = getOutcomeOrdersForDisplay(outcome.outcome);
          
          return (
            <div 
              key={outcome.id}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                selectedOutcome === outcome.outcome 
                  ? 'border-blue-500 bg-blue-900/20' 
                  : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
              }`}
              onClick={() => setSelectedOutcome(outcome.outcome)}
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-white">{outcome.outcome}</span>
                <span className="text-sm font-semibold text-blue-400">
                  ${outcome.price.toFixed(3)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${probability}%` }}
                    ></div>
                  </div>
                  <span className="text-gray-400">{probability.toFixed(1)}%</span>
                </div>
                
                {position !== 0 && (
                  <span className={`font-medium ${position > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {position > 0 ? 'Long' : 'Short'} {Math.abs(position)} shares
                  </span>
                )}
              </div>
              
              {/* Show order history for this outcome */}
              {outcomeOrders.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div className="text-xs text-gray-500">
                    Orders: {outcomeOrders.length} | 
                    Avg: ${(outcomeOrders.reduce((sum: number, order: Order) => sum + order.price, 0) / outcomeOrders.length).toFixed(3)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Trading Interface */}
      {selectedOutcome && (
        <div className="border-t border-gray-600 pt-4">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAction('buy')}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                action === 'buy'
                  ? 'bg-green-900 text-green-300 border-2 border-green-600'
                  : 'bg-gray-700 text-gray-300 border-2 border-gray-600'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setAction('sell')}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                action === 'sell'
                  ? 'bg-red-900 text-red-300 border-2 border-red-600'
                  : 'bg-gray-700 text-gray-300 border-2 border-gray-600'
              }`}
            >
              Sell
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <input
              type="number"
              min="1"
              value={shares === 0 ? '' : shares}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || val === '0') {
                  setShares(0);
                } else {
                  const num = parseInt(val);
                  if (!isNaN(num) && num > 0) {
                    setShares(num);
                  }
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-700 text-white"
              placeholder="Shares"
            />
            <button
              onClick={handleTrade}
              disabled={isPlacingOrder || shares < 1 || (action === 'buy' && (shares * (outcomeData.find(o => o.outcome === selectedOutcome)?.price || 0)) > currentBalance) || (action === 'sell' && getNetPosition(market.conditionId || market.id || '', selectedOutcome) < shares)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              data-market={market.conditionId || market.id}
            >
              {isPlacingOrder ? 'Placing...' : `${action === 'buy' ? 'Buy' : 'Sell'} ${shares} shares`}
            </button>
          </div>

          <div className="space-y-1 text-xs">
            <div className="text-gray-400">
              {action === 'buy' ? 'Cost' : 'Revenue'}: $
              {(shares * (outcomeData.find(o => o.outcome === selectedOutcome)?.price || 0)).toFixed(2)}
            </div>
            {action === 'buy' && (
              <div className={`${(shares * (outcomeData.find(o => o.outcome === selectedOutcome)?.price || 0)) > currentBalance ? 'text-red-400' : 'text-gray-400'}`}>
                Available: ${currentBalance.toFixed(2)}
              </div>
            )}
            {action === 'sell' && (
              <div className={`${getNetPosition(market.conditionId || market.id || '', selectedOutcome) < shares ? 'text-red-400' : 'text-gray-400'}`}>
                Owned: {getNetPosition(market.conditionId || market.id || '', selectedOutcome)} shares
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Info */}
      <div className="mt-4 pt-4 border-t border-gray-600">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Min order: ${market.orderMinSize || '0.01'}</span>
          <span>Min tick: ${market.orderPriceMinTickSize || '0.001'}</span>
        </div>
      </div>
    </div>
  );
} 