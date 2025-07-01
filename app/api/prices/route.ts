import { NextRequest, NextResponse } from 'next/server';

const POLYMARKET_API_BASE = 'https://clob.polymarket.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenIds = searchParams.get('token_ids');
    
    if (!tokenIds) {
      return NextResponse.json(
        { success: false, error: 'token_ids parameter is required' },
        { status: 400 }
      );
    }

    const tokenIdList = tokenIds.split(',');
    const prices: { [tokenId: string]: { price: string } } = {};
    
    // Fetch price for each token (both BUY and SELL sides)
    const pricePromises = tokenIdList.map(async (tokenId) => {
      try {
        // Get the buy price (this is typically what users see as the market price)
        const buyResponse = await fetch(`${POLYMARKET_API_BASE}/price?token_id=${tokenId.trim()}&side=buy`, {
          headers: {
            'Accept': 'application/json',
          },
        });
        
        if (buyResponse.ok) {
          const buyData = await buyResponse.json();
          prices[tokenId.trim()] = { price: buyData.price || "0.50" };
        } else {
          // Fallback price if API fails
          prices[tokenId.trim()] = { price: "0.50" };
        }
      } catch (error) {
        console.error(`Error fetching price for token ${tokenId}:`, error);
        prices[tokenId.trim()] = { price: "0.50" };
      }
    });
    
    await Promise.all(pricePromises);
    
    return NextResponse.json({
      success: true,
      data: prices
    });
  } catch (error) {
    console.error('Error fetching prices:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch prices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 