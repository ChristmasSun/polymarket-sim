import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Order, OrderBook } from '../../../types/orders';

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
    // File doesn't exist or is invalid, return empty order book
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

export async function GET() {
  try {
    const orderBook = await readOrders();
    
    return NextResponse.json(orderBook, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error reading orders:', error);
    return NextResponse.json(
      { error: 'Failed to read orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, marketQuestion, outcome, action, shares, price } = body;
    
    if (!marketId || !outcome || !action || !shares || !price) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const orderBook = await readOrders();
    
    // Server-side validation
    const STARTING_BALANCE = 10000;
    const totalInvested = orderBook.orders.reduce((sum, order) => sum + order.totalCost, 0);
    const currentBalance = STARTING_BALANCE - totalInvested;
    const totalCost = shares * price;
    
    // Validate buy orders
    if (action === 'buy') {
      if (totalCost > currentBalance) {
        return NextResponse.json(
          { 
            error: `Insufficient balance! You have $${currentBalance.toFixed(2)} but need $${totalCost.toFixed(2)} for this trade.`,
            currentBalance,
            requiredAmount: totalCost
          },
          { status: 400 }
        );
      }
    }
    
    // Validate sell orders
    if (action === 'sell') {
      const currentPosition = orderBook.orders
        .filter(order => order.marketId === marketId && order.outcome === outcome)
        .reduce((net, order) => {
          if (order.action === 'buy') {
            return net + order.shares;
          } else {
            return net - order.shares;
          }
        }, 0);
      
      if (currentPosition < shares) {
        return NextResponse.json(
          { 
            error: `Insufficient shares! You have ${currentPosition} shares but trying to sell ${shares}.`,
            currentPosition,
            requestedShares: shares
          },
          { status: 400 }
        );
      }
    }
    
    const newOrder: Order = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      marketQuestion,
      outcome,
      action,
      shares,
      price,
      totalCost: shares * price,
      timestamp: new Date().toISOString()
    };
    
    orderBook.orders.push(newOrder);
    orderBook.lastUpdated = new Date().toISOString();
    
    await writeOrders(orderBook);
    
    return NextResponse.json({ 
      success: true, 
      order: newOrder,
      message: `Order placed: ${action} ${shares} shares of "${outcome}" at $${price.toFixed(3)}`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
} 