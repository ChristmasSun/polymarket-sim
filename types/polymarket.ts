export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketMarket {
  id: string;
  conditionId: string;
  questionID: string;
  question: string;
  description: string;
  slug: string;
  endDateIso: string;
  startDateIso?: string;
  outcomes: string[];
  outcomePrices: string[];
  eventId?: string;
  eventTitle?: string;
  eventSlug?: string;
  
  condition_id?: string;
  question_id?: string;
  market_slug?: string;
  end_date_iso?: string;
  tokens?: PolymarketToken[];
  
  active: boolean;
  closed: boolean;
  archived: boolean;
  acceptingOrders: boolean;
  acceptingOrdersTimestamp?: string;
  
  // New fields for resolved markets
  isExpired?: boolean;
  hasResolvedOutcomes?: boolean;
  resolvedOutcome?: string | null;
  
  orderMinSize?: string;
  orderPriceMinTickSize?: string;
  minimum_order_size?: number;
  minimum_tick_size?: number;
  
  volume?: string;
  volume24hr?: string;
  volume1wk?: string;
  volume1mo?: string;
  liquidity?: string;
  lastTradePrice?: string;
  bestBid?: string;
  bestAsk?: string;
  spread?: string;
  
  icon?: string;
  image?: string;
  featured?: boolean;
  new?: boolean;
  competitive?: boolean;
  
  game_start_time?: string | null;
  seconds_delay?: number;
  fpmm?: string;
  maker_base_fee?: number;
  taker_base_fee?: number;
  notifications_enabled?: boolean;
  neg_risk?: boolean;
  neg_risk_market_id?: string;
  neg_risk_request_id?: string;
  rewards?: {
    rates: any;
    min_size: number;
    max_spread: number;
  };
  is_50_50_outcome?: boolean;
  tags?: string[];
  enable_order_book?: boolean;
  accepting_orders?: boolean;
  accepting_order_timestamp?: string | null;
}

export interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  end_date: string;
  markets: PolymarketMarket[];
  total_markets: number;
  icon?: string;
  groupedOutcomes?: GroupedOutcome[];
  totalOutcomes?: number;
  visibleOutcomes?: number;
}

export interface GroupedOutcome {
  outcome: string;
  price: number;
  probability: number;
  marketId: string;
  question: string;
  isVisible: boolean;
}

export interface MarketPrice {
  market: string;
  asset_id: string;
  price: string;
  timestamp: string;
}

export interface Position {
  id: string;
  market_id: string;
  question: string;
  outcome: string;
  shares: number;
  avg_price: number;
  current_price: number;
  total_invested: number;
  current_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
  timestamp: string;
}

export interface Portfolio {
  starting_balance: number;
  current_balance: number;
  total_invested: number;
  current_portfolio_value: number;
  total_profit_loss: number;
  total_profit_loss_percentage: number;
  positions: Position[];
  trade_history: Trade[];
}

export interface Trade {
  id: string;
  market_id: string;
  question: string;
  outcome: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  total_cost: number;
  timestamp: string;
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  market: string;
  asset_id: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: string;
} 