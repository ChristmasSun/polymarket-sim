export interface Order {
  id: string;
  marketId: string;
  marketQuestion: string;
  outcome: string;
  action: 'buy' | 'sell';
  shares: number;
  price: number;
  totalCost: number;
  timestamp: string;
  currentPrice?: number;
  currentValue?: number;
  pnl?: number;
  pnlPercentage?: number;
}

export interface OrderBook {
  orders: Order[];
  lastUpdated: string;
} 