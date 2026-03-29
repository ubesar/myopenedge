/**
 * Tradovate CSV order parser — matches filled Buy/Sell orders into trades via FIFO.
 * Supports MNQ, MES, MGC, MYM, M2K and their full-size counterparts.
 */

interface TradovateOrder {
  orderId: string;
  side: "Buy" | "Sell";
  product: string;
  productDescription: string;
  avgPrice: number;
  filledQty: number;
  fillTime: string;
  timestamp: string;
  status: string;
  contract: string;
}

export interface ParsedTrade {
  symbol: string;
  side: "long" | "short";
  qty: number;
  entry_price: number;
  exit_price: number;
  open_time: string;
  close_time: string;
  pnl_gross: number;
  pnl_net: number;
  source: string;
}

// Point values for common futures products
const POINT_VALUES: Record<string, number> = {
  MNQ: 2,
  NQ: 20,
  MES: 5,
  ES: 50,
  MGC: 10,
  GC: 100,
  MYM: 0.5,
  YM: 5,
  M2K: 5,
  RTY: 50,
  MCL: 100,
  CL: 1000,
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseTradovateDate(dateStr: string): string {
  // Format: "MM/DD/YYYY HH:MM:SS"
  const [datePart, timePart] = dateStr.split(" ");
  if (!datePart || !timePart) return dateStr;
  const [m, d, y] = datePart.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${timePart}`;
}

export function parseTradovateCSV(csvText: string): ParsedTrade[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const colIdx = (name: string) => headers.findIndex((h) => h === name);

  const iStatus = colIdx("Status");
  const iBS = colIdx("B/S");
  const iProduct = colIdx("Product");
  const iProductDesc = colIdx("Product Description");
  const iAvgPrice = colIdx("avgPrice");
  const iFilledQty = colIdx("filledQty");
  const iFillTime = colIdx("Fill Time");
  const iTimestamp = colIdx("Timestamp");
  const iOrderId = colIdx("orderId");
  const iContract = colIdx("Contract");

  // Parse only filled orders
  const filledOrders: TradovateOrder[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const status = cols[iStatus]?.trim();
    if (status !== "Filled") continue;

    const avgPrice = parseFloat(cols[iAvgPrice]);
    const filledQty = parseInt(cols[iFilledQty], 10);
    if (isNaN(avgPrice) || isNaN(filledQty) || filledQty <= 0) continue;

    filledOrders.push({
      orderId: cols[iOrderId],
      side: cols[iBS]?.trim() as "Buy" | "Sell",
      product: cols[iProduct]?.trim(),
      productDescription: cols[iProductDesc]?.trim(),
      avgPrice,
      filledQty,
      fillTime: cols[iFillTime]?.trim(),
      timestamp: cols[iTimestamp]?.trim(),
      status,
      contract: cols[iContract]?.trim(),
    });
  }

  // Sort by fill time
  filledOrders.sort(
    (a, b) => new Date(parseTradovateDate(a.fillTime)).getTime() - new Date(parseTradovateDate(b.fillTime)).getTime()
  );

  // FIFO matching per product
  const trades: ParsedTrade[] = [];
  const positionQueue: { side: "Buy" | "Sell"; price: number; qty: number; time: string; product: string }[] = [];

  for (const order of filledOrders) {
    let remaining = order.filledQty;
    const product = order.product;

    while (remaining > 0) {
      // Find opposite side in queue for same product
      const oppositeIdx = positionQueue.findIndex(
        (p) => p.product === product && p.side !== order.side
      );

      if (oppositeIdx === -1) {
        // No opposite — add to queue
        positionQueue.push({
          side: order.side,
          price: order.avgPrice,
          qty: remaining,
          time: order.fillTime,
          product,
        });
        break;
      }

      const opposite = positionQueue[oppositeIdx];
      const matchQty = Math.min(remaining, opposite.qty);
      const pointValue = POINT_VALUES[product] || 2;

      // Determine entry/exit
      const isLong = opposite.side === "Buy";
      const entryPrice = isLong ? opposite.price : order.avgPrice;
      const exitPrice = isLong ? order.avgPrice : opposite.price;
      const entryTime = isLong ? opposite.time : order.fillTime;
      const exitTime = isLong ? order.fillTime : opposite.time;

      // For short: entry is Sell (earlier), exit is Buy (later)
      const openTime = isLong ? opposite.time : opposite.time;
      const closeTime = isLong ? order.fillTime : order.fillTime;
      const openPrice = isLong ? opposite.price : opposite.price;
      const closePrice = isLong ? order.avgPrice : order.avgPrice;

      const priceDiff = isLong ? closePrice - openPrice : openPrice - closePrice;
      const pnl = priceDiff * matchQty * pointValue;

      trades.push({
        symbol: product,
        side: isLong ? "long" : "short",
        qty: matchQty,
        entry_price: openPrice,
        exit_price: closePrice,
        open_time: parseTradovateDate(openTime),
        close_time: parseTradovateDate(closeTime),
        pnl_gross: pnl,
        pnl_net: pnl, // no fee data in CSV
        source: "TRADOVATE",
      });

      remaining -= matchQty;
      opposite.qty -= matchQty;
      if (opposite.qty <= 0) {
        positionQueue.splice(oppositeIdx, 1);
      }
    }
  }

  return trades;
}
