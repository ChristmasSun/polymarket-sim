import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Order, OrderBook } from '../../../../types/orders';

const ORDERS_FILE = path.join(process.cwd(), 'data', 'orders.json');

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(ORDERS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Read orders from file
async function readOrders(): Promise<OrderBook> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      orders: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

// Write orders to file
async function writeOrders(orderBook: OrderBook) {
  await ensureDataDirectory();
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orderBook, null, 2));
}

// Calculate current P&L for an order based on current market prices
function calculateOrderPnl(order: Order, currentPrice: number): Order {
  const currentValue = order.shares * currentPrice;
  const pnl = currentValue - order.totalCost;
  const pnlPercentage = order.totalCost > 0 ? (pnl / order.totalCost) * 100 : 0;
  
  return {
    ...order,
    currentPrice,
    currentValue,
    pnl,
    pnlPercentage
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { markets } = body; // Array of current market data with prices
    
    if (!markets || !Array.isArray(markets)) {
      return NextResponse.json(
        { error: 'Missing markets data' },
        { status: 400 }
      );
    }
    
    const orderBook = await readOrders();
    const updatedOrders: Order[] = [];
    
    // Create a map of market outcomes to current prices
    const marketPrices = new Map<string, number>();
    markets.forEach((market: any) => {
      const outcomes = market.outcomes || [];
      const outcomePrices = market.outcomePrices || [];
      outcomes.forEach((outcome: string, index: number) => {
        const key = `${market.conditionId || market.id}-${outcome}`;
        marketPrices.set(key, parseFloat(outcomePrices[index] || '0'));
      });
    });
    
    // Update P&L for each order
    orderBook.orders.forEach((order) => {
      const priceKey = `${order.marketId}-${order.outcome}`;
      const currentPrice = marketPrices.get(priceKey) || order.price;
      
      const updatedOrder = calculateOrderPnl(order, currentPrice);
      updatedOrders.push(updatedOrder);
    });
    
    // Calculate summary statistics
    const totalInvested = updatedOrders.reduce((sum, order) => sum + order.totalCost, 0);
    const totalCurrentValue = updatedOrders.reduce((sum, order) => sum + (order.currentValue || 0), 0);
    const totalPnl = totalCurrentValue - totalInvested;
    const totalPnlPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    
    const updatedOrderBook: OrderBook = {
      orders: updatedOrders,
      lastUpdated: new Date().toISOString()
    };
    
    await writeOrders(updatedOrderBook);
    
    return NextResponse.json({
      success: true,
      orderBook: updatedOrderBook,
      summary: {
        totalOrders: updatedOrders.length,
        totalInvested,
        totalCurrentValue,
        totalPnl,
        totalPnlPercentage
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error updating P&L:', error);
    return NextResponse.json(
      { error: 'Failed to update P&L' },
      { status: 500 }
    );
  }
} 