import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';

    // Fetch markets from Manifold API
    const url = `https://api.manifold.markets/v0/markets?limit=200`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Manifold API error: ${response.status}`);
    }

    const markets = await response.json();

    // Filter open markets
    const openMarkets = markets.filter((market: any) => market.closeTime > Date.now());

    // Group markets by category/event
    const eventGroups: { [key: string]: any[] } = {};
    
    openMarkets.forEach((market: any) => {
      let category = 'Other';
      
      // Categorize markets based on keywords
      const question = market.question.toLowerCase();
      if (question.includes('election') || question.includes('president') || question.includes('gop') || question.includes('democrat')) {
        category = 'Elections & Politics';
      } else if (question.includes('sport') || question.includes('nfl') || question.includes('nba') || question.includes('mlb') || question.includes('pga') || question.includes('tour de france')) {
        category = 'Sports';
      } else if (question.includes('crypto') || question.includes('bitcoin') || question.includes('ethereum') || question.includes('defi')) {
        category = 'Cryptocurrency';
      } else if (question.includes('ai') || question.includes('artificial intelligence') || question.includes('gpt') || question.includes('openai')) {
        category = 'Technology & AI';
      } else if (question.includes('movie') || question.includes('film') || question.includes('oscar') || question.includes('award')) {
        category = 'Entertainment';
      } else if (question.includes('weather') || question.includes('climate') || question.includes('temperature')) {
        category = 'Weather & Climate';
      } else if (question.includes('economy') || question.includes('inflation') || question.includes('fed') || question.includes('interest rate')) {
        category = 'Economy & Finance';
      }

      if (!eventGroups[category]) {
        eventGroups[category] = [];
      }
      eventGroups[category].push(market);
    });

    // Convert to events format
    const events = Object.entries(eventGroups)
      .map(([category, markets]) => ({
        id: category.toLowerCase().replace(/\s+/g, '-'),
        title: category,
        description: `${markets.length} active markets in ${category}`,
        markets: markets.slice(0, 5).map((market: any) => ({
          id: market.id,
          title: market.question,
          outcomeType: market.outcomeType,
          totalLiquidity: market.totalLiquidity || 0,
          volume24h: market.volume24h || 0,
          closeTime: market.closeTime,
          outcomes: market.outcomeType === 'BINARY' ? [
            { text: 'Yes', probability: market.probability || 0 },
            { text: 'No', probability: 1 - (market.probability || 0) }
          ] : market.answers?.map((answer: any) => ({
            text: answer.text,
            probability: answer.probability || 0,
            totalLiquidity: answer.totalLiquidity || 0
          })) || []
        })),
        totalMarkets: markets.length,
        totalLiquidity: markets.reduce((sum: number, market: any) => sum + (market.totalLiquidity || 0), 0)
      }))
      .sort((a, b) => b.totalLiquidity - a.totalLiquidity)
      .slice(0, parseInt(limit));

    return NextResponse.json({
      events,
      total: events.length,
      source: 'Manifold Markets API',
      note: 'Real prediction markets from Manifold Markets with complete multi-outcome support'
    });

  } catch (error) {
    console.error('Error fetching Manifold events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events from Manifold' },
      { status: 500 }
    );
  }
} 