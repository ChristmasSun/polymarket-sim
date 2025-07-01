import { NextRequest, NextResponse } from 'next/server';
import { PolymarketMarket } from '../markets/route';

export interface PolymarketEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  end_date: string;
  markets: PolymarketMarket[];
  total_markets: number;
  icon?: string;
  // New fields for grouped markets
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
  isVisible: boolean; // Whether to show by default (>2% probability)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';

    // Fetch markets from our markets API
    const marketsResponse = await fetch(`${request.nextUrl.origin}/api/markets?limit=500`);
    if (!marketsResponse.ok) {
      throw new Error('Failed to fetch markets');
    }
    
    const marketsData = await marketsResponse.json();
    const markets: PolymarketMarket[] = marketsData.markets;

    const now = new Date();
    console.log('[DEBUG] Total markets before filtering:', markets.length);
    
    // Only show markets that have not ended yet
    const validMarkets = markets.filter((market) => {
      const endDateIso = (market as any).endDateIso || market.end_date_iso || '';
      const endDate = new Date(endDateIso);
      
      if (market.question && market.question.toLowerCase().includes('reconciliation')) {
        console.log('[DEBUG] Market data:', {
          question: market.question,
          endDateIso: endDateIso,
          endDate: endDate.toISOString(),
          now: now.toISOString(),
          isValid: endDate > now,
          hasEndDateIso: !!(market as any).endDateIso,
          hasEndDateIsoLegacy: !!market.end_date_iso
        });
      }
      
      return endDate > now;
    });
    
    console.log('[DEBUG] Valid markets after filtering:', validMarkets.length);
    console.log('[DEBUG] Filtered out markets:', markets.length - validMarkets.length);
    
    // Log any reconciliation markets that made it through
    const reconciliationMarkets = validMarkets.filter(market => 
      market.question && market.question.toLowerCase().includes('reconciliation')
    );
    console.log('[DEBUG] Reconciliation markets after filtering:', reconciliationMarkets.length);
    reconciliationMarkets.forEach(market => {
      const endDate = new Date(((market as any).endDateIso || market.end_date_iso || ''));
      console.log('[DEBUG] Reconciliation market that passed filter:', market.question, '| endDate:', endDate.toISOString());
    });

    // Separate binary and multi-candidate markets
    const binaryMarkets: PolymarketMarket[] = [];
    const multiMarketsByEvent: Record<string, PolymarketMarket[]> = {};

    validMarkets.forEach((market: any) => {
      const outcomes = market.outcomes || market.outcomes || [];
      if (outcomes.length === 2) {
        binaryMarkets.push(market);
      } else if (outcomes.length > 2) {
        const eventId = market.eventId || market.eventSlug || extractEventId(market.question);
        if (!multiMarketsByEvent[eventId]) multiMarketsByEvent[eventId] = [];
        multiMarketsByEvent[eventId].push(market);
      }
    });

    // Create events for multi-candidate markets
    const multiEvents: PolymarketEvent[] = Object.entries(multiMarketsByEvent).map(([eventId, markets]) => {
      // Use the first market as the representative for event title, etc.
      const rep: any = markets[0];
      const eventTitle = rep.eventTitle || extractEventTitle(rep.question);
      const category = extractCategory(rep);
      const groupedOutcomes: GroupedOutcome[] = [];
      markets.forEach((market: any) => {
        const outcomes = market.outcomes || [];
        const outcomePrices = market.outcomePrices || [];
        if (outcomes.length && outcomePrices.length) {
          outcomes.forEach((outcome: string, index: number) => {
            const price = parseFloat(outcomePrices[index] || '0');
            const totalProbability = outcomePrices.reduce((sum: number, p: string) => sum + parseFloat(p), 0);
            const probability = totalProbability > 0 ? (price / totalProbability * 100) : 0;
            groupedOutcomes.push({
              outcome,
              price,
              probability,
              marketId: market.conditionId || market.id,
              question: market.question,
              isVisible: probability > 2
            });
          });
        }
      });
      groupedOutcomes.sort((a, b) => b.probability - a.probability);
      return {
        id: eventId,
        title: eventTitle,
        description: `Prediction markets related to ${eventTitle}`,
        category,
        end_date: (rep as any).endDateIso || rep.end_date_iso || '',
        markets,
        total_markets: markets.length,
        icon: rep.icon,
        groupedOutcomes,
        totalOutcomes: groupedOutcomes.length,
        visibleOutcomes: groupedOutcomes.filter(o => o.isVisible).length
      };
    });

    // Create events for binary markets (no grouping)
    const binaryEvents: PolymarketEvent[] = binaryMarkets.map((market: any) => {
      const category = extractCategory(market);
      return {
        id: market.id,
        title: market.question,
        description: market.description || '',
        category,
        end_date: (market as any).endDateIso || market.end_date_iso || '',
        markets: [market],
        total_markets: 1,
        icon: market.icon
        // No groupedOutcomes field
      };
    });

    // Combine and sort events
    const allEvents = [...multiEvents, ...binaryEvents]
      .sort((a, b) => b.total_markets - a.total_markets)
      .slice(0, parseInt(limit));

    return NextResponse.json({
      events: allEvents,
      count: allEvents.length,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      }
    );
  }
}

// Helper functions to extract event information
function extractEventId(question: string): string {
  // Extract event ID from question patterns
  const patterns = [
    /(?:who will win|who will be|who will become|who will get) (.+)/i,
    /(.+?) (?:election|race|contest|championship|award)/i,
    /(.+?) (?:winner|champion|award)/i
  ];
  
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      return match[1].toLowerCase().replace(/\s+/g, '-');
    }
  }
  
  return question.toLowerCase().replace(/\s+/g, '-').substring(0, 50);
}

function extractEventTitle(question: string): string {
  // Extract event title from question patterns
  const patterns = [
    /(?:who will win|who will be|who will become|who will get) (.+)/i,
    /(.+?) (?:election|race|contest|championship|award)/i,
    /(.+?) (?:winner|champion|award)/i
  ];
  
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return question;
}

function extractCategory(market: PolymarketMarket): string {
  // Extract category from tags or question
  let category = 'General';
  
  // Look for specific categories in tags
  if (market.tags && market.tags.length > 0) {
    const categoryTags = ['Politics', 'Sports', 'Crypto', 'Entertainment', 'Technology', 'Finance'];
    for (const tag of market.tags) {
      if (categoryTags.includes(tag)) {
        category = tag;
        break;
      }
    }
    
    // Special handling for sports categories
    if (market.tags.includes('NBA') || market.question.toLowerCase().includes('nba')) {
      category = 'Sports';
    } else if (market.tags.includes('NFL') || market.question.toLowerCase().includes('nfl')) {
      category = 'Sports';
    } else if (market.tags.includes('MLB') || market.question.toLowerCase().includes('mlb')) {
      category = 'Sports';
    } else if (market.tags.includes('UFC') || market.question.toLowerCase().includes('ufc')) {
      category = 'Sports';
    } else if (market.tags.includes('World Cup') || market.question.toLowerCase().includes('world cup')) {
      category = 'Sports';
    }
    
    // Politics detection
    if (market.tags.includes('Politics') || market.tags.includes('U.S. Politics') || 
        market.question.toLowerCase().includes('president') || 
        market.question.toLowerCase().includes('election') ||
        market.question.toLowerCase().includes('biden') ||
        market.question.toLowerCase().includes('trump')) {
      category = 'Politics';
    }
    
    // Crypto detection
    if (market.tags.includes('Crypto') || market.tags.includes('blockchain') ||
        market.question.toLowerCase().includes('eth') ||
        market.question.toLowerCase().includes('bitcoin') ||
        market.question.toLowerCase().includes('crypto')) {
      category = 'Crypto';
    }
  }
  
  return category;
} 