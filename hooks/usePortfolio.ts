import { useState, useEffect } from 'react';
import { Portfolio, Position, Trade } from '@/types/polymarket';

const INITIAL_BALANCE = 1000; // $1000 starting balance
const STORAGE_KEY = 'polymarket_simulator_portfolio';

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio>({
    starting_balance: INITIAL_BALANCE,
    current_balance: INITIAL_BALANCE,
    total_invested: 0,
    current_portfolio_value: 0,
    total_profit_loss: 0,
    total_profit_loss_percentage: 0,
    positions: [],
    trade_history: []
  });

  // Load portfolio from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedPortfolio = JSON.parse(stored);
        setPortfolio(parsedPortfolio);
      } catch (error) {
        console.error('Error loading portfolio from storage:', error);
      }
    }
  }, []);

  // Save portfolio to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  }, [portfolio]);

  const buyShares = (
    marketId: string,
    question: string,
    outcome: string,
    shares: number,
    price: number
  ) => {
    const totalCost = shares * price;
    
    if (totalCost > portfolio.current_balance) {
      throw new Error('Insufficient balance');
    }

    const trade: Trade = {
      id: Date.now().toString(),
      market_id: marketId,
      question,
      outcome,
      type: 'BUY',
      shares,
      price,
      total_cost: totalCost,
      timestamp: new Date().toISOString()
    };

    setPortfolio(prev => {
      const existingPositionIndex = prev.positions.findIndex(
        p => p.market_id === marketId && p.outcome === outcome
      );

      let newPositions = [...prev.positions];
      
      if (existingPositionIndex >= 0) {
        // Update existing position
        const existingPosition = prev.positions[existingPositionIndex];
        const totalShares = existingPosition.shares + shares;
        const totalInvested = existingPosition.total_invested + totalCost;
        const avgPrice = totalInvested / totalShares;
        
        newPositions[existingPositionIndex] = {
          ...existingPosition,
          shares: totalShares,
          avg_price: avgPrice,
          total_invested: totalInvested,
          current_price: price, // Will be updated with real-time data
          current_value: totalShares * price,
          profit_loss: (totalShares * price) - totalInvested,
          profit_loss_percentage: ((totalShares * price) - totalInvested) / totalInvested * 100
        };
      } else {
        // Create new position
        const newPosition: Position = {
          id: Date.now().toString(),
          market_id: marketId,
          question,
          outcome,
          shares,
          avg_price: price,
          current_price: price,
          total_invested: totalCost,
          current_value: shares * price,
          profit_loss: 0,
          profit_loss_percentage: 0,
          timestamp: new Date().toISOString()
        };
        newPositions.push(newPosition);
      }

      const newBalance = prev.current_balance - totalCost;
      const newTotalInvested = prev.total_invested + totalCost;
      const newPortfolioValue = newPositions.reduce((sum, pos) => sum + pos.current_value, 0);
      const newTotalPL = newPortfolioValue - newTotalInvested;
      const newTotalPLPercentage = newTotalInvested > 0 ? (newTotalPL / newTotalInvested) * 100 : 0;

      return {
        ...prev,
        current_balance: newBalance,
        total_invested: newTotalInvested,
        current_portfolio_value: newPortfolioValue,
        total_profit_loss: newTotalPL,
        total_profit_loss_percentage: newTotalPLPercentage,
        positions: newPositions,
        trade_history: [...prev.trade_history, trade]
      };
    });
  };

  const sellShares = (
    marketId: string,
    question: string,
    outcome: string,
    shares: number,
    price: number
  ) => {
    const positionIndex = portfolio.positions.findIndex(
      p => p.market_id === marketId && p.outcome === outcome
    );

    if (positionIndex === -1) {
      throw new Error('Position not found');
    }

    const position = portfolio.positions[positionIndex];
    if (shares > position.shares) {
      throw new Error('Cannot sell more shares than owned');
    }

    const totalRevenue = shares * price;

    const trade: Trade = {
      id: Date.now().toString(),
      market_id: marketId,
      question,
      outcome,
      type: 'SELL',
      shares,
      price,
      total_cost: totalRevenue,
      timestamp: new Date().toISOString()
    };

    setPortfolio(prev => {
      let newPositions = [...prev.positions];
      
      if (shares === position.shares) {
        // Sell entire position
        newPositions.splice(positionIndex, 1);
      } else {
        // Partial sell
        const remainingShares = position.shares - shares;
        const soldInvestment = (shares / position.shares) * position.total_invested;
        const remainingInvestment = position.total_invested - soldInvestment;
        
        newPositions[positionIndex] = {
          ...position,
          shares: remainingShares,
          total_invested: remainingInvestment,
          current_value: remainingShares * price,
          profit_loss: (remainingShares * price) - remainingInvestment,
          profit_loss_percentage: remainingInvestment > 0 ? ((remainingShares * price) - remainingInvestment) / remainingInvestment * 100 : 0
        };
      }

      const newBalance = prev.current_balance + totalRevenue;
      const newTotalInvested = newPositions.reduce((sum, pos) => sum + pos.total_invested, 0);
      const newPortfolioValue = newPositions.reduce((sum, pos) => sum + pos.current_value, 0);
      const newTotalPL = (newBalance + newPortfolioValue) - prev.starting_balance;
      const newTotalPLPercentage = ((newBalance + newPortfolioValue) - prev.starting_balance) / prev.starting_balance * 100;

      return {
        ...prev,
        current_balance: newBalance,
        total_invested: newTotalInvested,
        current_portfolio_value: newPortfolioValue,
        total_profit_loss: newTotalPL,
        total_profit_loss_percentage: newTotalPLPercentage,
        positions: newPositions,
        trade_history: [...prev.trade_history, trade]
      };
    });
  };

  const updatePositionPrices = (priceUpdates: { [tokenId: string]: number }) => {
    setPortfolio(prev => {
      const newPositions = prev.positions.map(position => {
        // This would need to map token IDs to positions - simplified for now
        const newPrice = priceUpdates[position.market_id] || position.current_price;
        const newValue = position.shares * newPrice;
        const newPL = newValue - position.total_invested;
        const newPLPercentage = position.total_invested > 0 ? (newPL / position.total_invested) * 100 : 0;

        return {
          ...position,
          current_price: newPrice,
          current_value: newValue,
          profit_loss: newPL,
          profit_loss_percentage: newPLPercentage
        };
      });

      const newPortfolioValue = newPositions.reduce((sum, pos) => sum + pos.current_value, 0);
      const newTotalPL = (prev.current_balance + newPortfolioValue) - prev.starting_balance;
      const newTotalPLPercentage = ((prev.current_balance + newPortfolioValue) - prev.starting_balance) / prev.starting_balance * 100;

      return {
        ...prev,
        current_portfolio_value: newPortfolioValue,
        total_profit_loss: newTotalPL,
        total_profit_loss_percentage: newTotalPLPercentage,
        positions: newPositions
      };
    });
  };

  const resetPortfolio = () => {
    const newPortfolio: Portfolio = {
      starting_balance: INITIAL_BALANCE,
      current_balance: INITIAL_BALANCE,
      total_invested: 0,
      current_portfolio_value: 0,
      total_profit_loss: 0,
      total_profit_loss_percentage: 0,
      positions: [],
      trade_history: []
    };
    setPortfolio(newPortfolio);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPortfolio));
  };

  return {
    portfolio,
    buyShares,
    sellShares,
    updatePositionPrices,
    resetPortfolio
  };
} 