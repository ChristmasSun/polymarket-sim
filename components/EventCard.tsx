'use client';

import { useState } from 'react';
import { PolymarketEvent, Portfolio, GroupedOutcome } from '../types/polymarket';

interface EventCardProps {
  event: PolymarketEvent;
  onBuy: (marketId: string, question: string, outcome: string, shares: number, price: number) => void;
  onSell: (marketId: string, question: string, outcome: string, shares: number, price: number) => void;
  portfolio: Portfolio;
}

export default function EventCard({ event, onBuy, onSell, portfolio }: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAllOutcomes, setShowAllOutcomes] = useState(false);

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

  const getTotalLiquidity = () => {
    if (event.groupedOutcomes) {
      return event.groupedOutcomes.reduce((total, outcome) => total + outcome.price, 0);
    }
    return event.markets.reduce((total, market) => {
      const marketTotal = market.outcomePrices?.reduce((sum, price) => sum + parseFloat(price), 0) || 0;
      return total + marketTotal;
    }, 0);
  };

  const getTotalOutcomes = () => {
    return event.groupedOutcomes?.length || event.markets.reduce((total, market) => {
      return total + (market.outcomes?.length || 0);
    }, 0);
  };

  const getVisibleOutcomes = () => {
    if (!event.groupedOutcomes) return [];
    
    if (showAllOutcomes) {
      return event.groupedOutcomes;
    }
    
    return event.groupedOutcomes.filter(outcome => outcome.isVisible);
  };

  const getPortfolioPosition = (outcome: string, marketId: string) => {
    const position = portfolio.positions.find(
      (p: any) => p.market_id === marketId && p.outcome === outcome
    );
    return position ? position.shares : 0;
  };

  const handleTrade = (outcome: GroupedOutcome, action: 'buy' | 'sell', shares: number) => {
    try {
      if (action === 'buy') {
        onBuy(outcome.marketId, outcome.question, outcome.outcome, shares, outcome.price);
      } else {
        onSell(outcome.marketId, outcome.question, outcome.outcome, shares, outcome.price);
      }
    } catch (error) {
      console.error('Trade failed:', error);
    }
  };

  const visibleOutcomes = getVisibleOutcomes();
  const hasHiddenOutcomes = event.groupedOutcomes && event.groupedOutcomes.length > visibleOutcomes.length;

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-6 hover:shadow-xl transition-shadow">
      {/* Event Header */}
      <div className="mb-4">
        <h3 className="font-semibold text-white text-lg mb-2 line-clamp-2">
          {event.title}
        </h3>
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Ends: {formatDate(event.end_date)}</span>
          <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300">
            {event.markets.length} markets
          </span>
        </div>
      </div>

      {/* Event Description */}
      {event.description && (
        <p className="text-gray-400 text-sm mb-4 line-clamp-3">
          {event.description}
        </p>
      )}

      {/* Event Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
        <div className="bg-gray-700 rounded-xl p-3">
          <div className="text-lg font-semibold text-white">{event.total_markets}</div>
          <div className="text-xs text-gray-400">Markets</div>
        </div>
        <div className="bg-gray-700 rounded-xl p-3">
          <div className="text-lg font-semibold text-white">
            ${getTotalLiquidity().toFixed(0)}
          </div>
          <div className="text-xs text-gray-400">Total Value</div>
        </div>
        <div className="bg-gray-700 rounded-xl p-3">
          <div className="text-lg font-semibold text-white">
            {getTotalOutcomes()}
          </div>
          <div className="text-xs text-gray-400">Outcomes</div>
        </div>
      </div>

      {/* Grouped Outcomes */}
      {expanded && event.groupedOutcomes && (
        <div className="border-t border-gray-600 pt-4">
          <h4 className="font-medium text-white mb-3">Outcomes:</h4>
          <div className="space-y-3">
            {visibleOutcomes.map((outcome, index) => {
              const position = getPortfolioPosition(outcome.outcome, outcome.marketId);
              
              return (
                <div key={`${outcome.marketId}-${index}`} className="bg-gray-700 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h5 className="font-medium text-white text-sm mb-1">
                        {outcome.outcome}
                      </h5>
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {outcome.question}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-lg font-semibold text-blue-400">
                        ${outcome.price.toFixed(3)}
                      </div>
                      <div className="text-sm text-gray-400">
                        {outcome.probability.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Probability Bar */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${outcome.probability}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Portfolio Position */}
                  {position > 0 && (
                    <div className="mb-3">
                      <span className="text-green-400 font-medium text-sm">
                        You own {position} shares
                      </span>
                    </div>
                  )}
                  
                  {/* Quick Trade Buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTrade(outcome, 'buy', 1)}
                      disabled={portfolio.current_balance < outcome.price}
                      className="flex-1 py-2 px-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      Buy $1
                    </button>
                    <button
                      onClick={() => handleTrade(outcome, 'sell', 1)}
                      disabled={position < 1}
                      className="flex-1 py-2 px-3 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    >
                      Sell $1
                    </button>
                  </div>
                </div>
              );
            })}
            
            {/* Show More/Less Button */}
            {hasHiddenOutcomes && (
              <div className="text-center">
                <button
                  onClick={() => setShowAllOutcomes(!showAllOutcomes)}
                  className="px-4 py-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                >
                  {showAllOutcomes 
                    ? `Show less (${event.visibleOutcomes || 0} main outcomes)` 
                    : `Show ${event.groupedOutcomes!.length - visibleOutcomes.length} more outcomes`
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legacy Markets Display (fallback) */}
      {expanded && !event.groupedOutcomes && (
        <div className="border-t border-gray-600 pt-4">
          <h4 className="font-medium text-white mb-3">Markets in this category:</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {event.markets.slice(0, 5).map((market) => (
              <div key={market.conditionId || market.id} className="bg-gray-700 rounded-xl p-3">
                <h5 className="font-medium text-white text-sm mb-2 line-clamp-2">
                  {market.question}
                </h5>
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>{market.outcomes?.length || 0} outcomes</span>
                  <span>Ends: {formatDate(market.endDateIso || market.end_date_iso || '')}</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {market.outcomes?.slice(0, 3).map((outcome, index) => (
                    <span 
                      key={`${market.id}-${index}`}
                      className="px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded-full"
                    >
                      {outcome}: ${parseFloat(market.outcomePrices?.[index] || '0').toFixed(3)}
                    </span>
                  ))}
                  {market.outcomes && market.outcomes.length > 3 && (
                    <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded-full">
                      +{market.outcomes.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
            {event.markets.length > 5 && (
              <div className="text-center text-sm text-gray-400">
                ... and {event.markets.length - 5} more markets
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-gray-600">
        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {expanded ? 'Hide Details' : 'View Outcomes'}
          </button>
        </div>
      </div>
    </div>
  );
}