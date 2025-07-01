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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, currentPrice, markets } = body;
    
    if (!orderId || currentPrice === undefined || !markets) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, currentPrice, markets' },
        { status: 400 }
      );
    }
    
    const orderBook = await readOrders();
    
    // Find the order to sell
    const orderIndex = orderBook.orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }
    
    const order = orderBook.orders[orderIndex];
    
    // Validate that this is a buy order (you can only sell what you bought)
    if (order.action !== 'buy') {
      return NextResponse.json(
        { error: 'Can only sell buy orders' },
        { status: 400 }
      );
    }
    
    // Calculate sale proceeds
    const saleProceeds = order.shares * currentPrice;
    const profit = saleProceeds - order.totalCost;
    const profitPercentage = order.totalCost > 0 ? (profit / order.totalCost) * 100 : 0;
    
    // Remove the order from the list
    orderBook.orders.splice(orderIndex, 1);
    orderBook.lastUpdated = new Date().toISOString();
    
    await writeOrders(orderBook);
    
    return NextResponse.json({
      success: true,
      soldOrder: order,
      saleDetails: {
        orderId,
        shares: order.shares,
        buyPrice: order.price,
        sellPrice: currentPrice,
        buyTotal: order.totalCost,
        saleProceeds,
        profit,
        profitPercentage
      },
      message: `Sold ${order.shares} shares of "${order.outcome}" at $${currentPrice.toFixed(3)} for a ${profit >= 0 ? 'profit' : 'loss'} of $${Math.abs(profit).toFixed(2)} (${profitPercentage.toFixed(1)}%)`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error('Error selling order:', error);
    return NextResponse.json(
      { error: 'Failed to sell order' },
      { status: 500 }
    );
  }
} 