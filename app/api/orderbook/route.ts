import { NextRequest, NextResponse } from 'next/server';

const POLYMARKET_API_BASE = 'https://clob.polymarket.com';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('token_id');
    
    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: 'token_id parameter is required' },
        { status: 400 }
      );
    }

    const url = `${POLYMARKET_API_BASE}/book?token_id=${tokenId}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error fetching order book:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch order book',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 