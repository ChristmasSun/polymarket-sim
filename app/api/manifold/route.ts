import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const search = searchParams.get('search') || '';

    // Fetch markets from Manifold API
    const url = `https://api.manifold.markets/v0/markets?limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Manifold API error: ${response.status}`);
    }

    const markets = await response.json();

    // Filter and transform the data
    const filteredMarkets = markets
      .filter((market: any) => {
        // Filter out closed markets and apply search if provided
        const isOpen = market.closeTime > Date.now();
        const matchesSearch = !search || 
          market.question.toLowerCase().includes(search.toLowerCase());
        return isOpen && matchesSearch;
      });

    // For multi-choice markets, fetch individual details to get outcomes
    const marketsWithOutcomes = await Promise.all(
      filteredMarkets.map(async (market: any) => {
        if (market.outcomeType === 'MULTIPLE_CHOICE' && (!market.answers || market.answers.length === 0)) {
          try {
            const detailResponse = await fetch(`https://api.manifold.markets/v0/market/${market.id}`);
            if (detailResponse.ok) {
              const detail = await detailResponse.json();
              market.answers = detail.answers || [];
            }
          } catch (error) {
            console.warn(`Failed to fetch details for market ${market.id}:`, error);
          }
        }
        
        return {
          id: market.id,
          title: market.question,
          description: market.description || '',
          closeTime: market.closeTime,
          outcomeType: market.outcomeType,
          totalLiquidity: market.totalLiquidity || 0,
          volume24h: market.volume24h || 0,
          answers: market.answers || [],
          probability: market.probability || 0,
          // For binary markets, create Yes/No outcomes
          outcomes: market.outcomeType === 'BINARY' ? [
            { text: 'Yes', probability: market.probability || 0 },
            { text: 'No', probability: 1 - (market.probability || 0) }
          ] : market.answers?.map((answer: any) => ({
            text: answer.text,
            probability: answer.probability || 0,
            totalLiquidity: answer.totalLiquidity || 0
          })) || []
        };
      })
    );

    const sortedMarkets = marketsWithOutcomes.sort((a: any, b: any) => b.totalLiquidity - a.totalLiquidity);

    return NextResponse.json({
      markets: sortedMarkets,
      total: sortedMarkets.length,
      source: 'Manifold Markets API'
    });

  } catch (error) {
    console.error('Error fetching Manifold markets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch markets from Manifold' },
      { status: 500 }
    );
  }
} 