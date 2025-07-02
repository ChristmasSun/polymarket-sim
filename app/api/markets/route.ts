import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export interface PolymarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface PolymarketMarket {
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time: string | null;
  seconds_delay: number;
  fpmm: string;
  maker_base_fee: number;
  taker_base_fee: number;
  notifications_enabled: boolean;
  neg_risk: boolean;
  neg_risk_market_id: string;
  neg_risk_request_id: string;
  icon: string;
  image: string;
  rewards: {
    rates: any;
    min_size: number;
    max_spread: number;
  };
  is_50_50_outcome: boolean;
  tokens: PolymarketToken[];
  tags: string[];
  enable_order_book: boolean;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  accepting_order_timestamp: string | null;
  minimum_order_size: number;
  minimum_tick_size: number;
}

export async function GET(request: NextRequest) {
  try {
    // Fetch the real Polymarket markets page
    const response = await fetch('https://polymarket.com/markets', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      throw new Error('Failed to fetch Polymarket site');
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract the embedded JSON from the __NEXT_DATA__ script tag
    const nextDataRaw = $("script#__NEXT_DATA__").html();
    if (!nextDataRaw) throw new Error('Could not find __NEXT_DATA__');
    const nextData = JSON.parse(nextDataRaw);

    // Path to events: props.pageProps.dehydratedState.queries[0].state.data.events
    const events = nextData?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.events || [];

    // Flatten all markets from all events
    const allMarkets = events.flatMap((event: any) => (event.markets || []).map((market: any) => {
      // Transform the market data to match our expected interface
      return {
        id: market.id,
        conditionId: market.conditionId,
        questionID: market.questionID,
        question: market.question,
        description: market.description || '',
        slug: market.slug,
        endDateIso: market.endDateIso,
        startDateIso: market.startDateIso,
        outcomes: market.outcomes || [],
        outcomePrices: market.outcomePrices || [],
        eventId: event.id,
        eventTitle: event.title,
        eventSlug: event.slug,
        
        // Legacy fields for backward compatibility
        condition_id: market.conditionId,
        question_id: market.questionID,
        market_slug: market.slug,
        end_date_iso: market.endDateIso,
        tokens: market.tokens || [],
        
        // Market status
        active: market.active || false,
        closed: market.closed || false,
        archived: market.archived || false,
        acceptingOrders: market.acceptingOrders || false,
        acceptingOrdersTimestamp: market.acceptingOrdersTimestamp,
        
        // Trading parameters
        orderMinSize: market.orderMinSize,
        orderPriceMinTickSize: market.orderPriceMinTickSize,
        minimum_order_size: market.minimum_order_size,
        minimum_tick_size: market.minimum_tick_size,
        
        // Additional fields
        volume: market.volume,
        volume24hr: market.volume24hr,
        volume1wk: market.volume1wk,
        volume1mo: market.volume1mo,
        liquidity: market.liquidity,
        lastTradePrice: market.lastTradePrice,
        bestBid: market.bestBid,
        bestAsk: market.bestAsk,
        spread: market.spread,
        
        // Market metadata
        icon: market.icon,
        image: market.image,
        featured: market.featured,
        new: market.new,
        competitive: market.competitive,
        
        // Legacy fields
        game_start_time: market.game_start_time,
        seconds_delay: market.seconds_delay,
        fpmm: market.fpmm,
        maker_base_fee: market.maker_base_fee,
        taker_base_fee: market.taker_base_fee,
        notifications_enabled: market.notifications_enabled,
        neg_risk: market.neg_risk,
        neg_risk_market_id: market.neg_risk_market_id,
        neg_risk_request_id: market.neg_risk_request_id,
        rewards: market.rewards,
        is_50_50_outcome: market.is_50_50_outcome,
        tags: market.tags || [],
        enable_order_book: market.enable_order_book,
        accepting_orders: market.accepting_orders,
        accepting_order_timestamp: market.accepting_order_timestamp,
      };
    }));

    // Set default end date for markets with missing or invalid end date
    const DEFAULT_END_DATE = '2025-12-31';
    const allMarketsWithDefaultDate = allMarkets.map((market: any) => {
      let endDateRaw = market.endDateIso || market.end_date_iso || '';
      let validDate = true;
      if (!endDateRaw) validDate = false;
      else {
        const d = new Date(endDateRaw);
        if (isNaN(d.getTime())) validDate = false;
      }
      if (!validDate) {
        return {
          ...market,
          endDateIso: DEFAULT_END_DATE,
          end_date_iso: DEFAULT_END_DATE,
        };
      }
      return market;
    });

    // Filter out expired markets, but include those with the default date
    const now = new Date();
    const validMarkets = allMarketsWithDefaultDate.filter((market: any) => {
      const endDateRaw = market.endDateIso || market.end_date_iso || '';
      const endDate = new Date(endDateRaw);
      return endDate > now;
    });

    console.log(`[DEBUG] Markets API: Total markets: ${allMarkets.length}, Valid markets: ${validMarkets.length}, Filtered out: ${allMarkets.length - validMarkets.length}`);

    return NextResponse.json({ markets: validMarkets, count: validMarkets.length }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  }
} 