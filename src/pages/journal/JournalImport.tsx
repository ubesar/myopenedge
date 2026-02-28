import { useState, useCallback, useRef, useEffect } from 'react';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/trading-data';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, ArrowRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type BrokerFormat = 'auto' | 'tradovate' | 'ninjatrader' | 'tradingview' | 'metatrader' | 'generic';

interface ParsedTrade {
  symbol: string; side: string; qty: number; entry_price: number; exit_price: number;
  open_time: string; close_time: string; pnl_gross: number; fees: number; pnl_net: number;
  valid: boolean; error?: string;
}

// --- CSV Parser ---
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(parseLine);
  return { headers, rows };
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  return parseFloat(cleaned) || 0;
}

function parseDate(s: string): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeSide(s: string): string {
  const lower = s.toLowerCase().trim();
  if (['buy', 'long', 'b'].includes(lower)) return 'LONG';
  if (['sell', 'short', 's'].includes(lower)) return 'SHORT';
  return s.toUpperCase();
}

function getCol(row: string[], headers: string[], colName: string): string {
  const idx = headers.findIndex(h => h.toLowerCase().trim() === colName.toLowerCase().trim());
  return idx >= 0 ? (row[idx] || '').trim() : '';
}

// --- Broker Detection ---
function detectBroker(headers: string[]): BrokerFormat {
  const h = headers.map(x => x.toLowerCase().trim());
  // Tradovate orders: has "b/s", "contract", "status", "avgprice"
  if (h.includes('b/s') && h.includes('contract') && h.includes('status')) return 'tradovate';
  if (h.includes('instrument') && h.includes('market pos.')) return 'ninjatrader';
  if (h.includes('symbol') && h.includes('side') && h.includes('close price')) return 'tradingview';
  if (h.includes('symbol') && h.includes('type') && h.includes('volume')) return 'metatrader';
  if (h.includes('symbol') && h.includes('side') && h.includes('entry_price')) return 'generic';
  return 'auto';
}

// --- Tradovate Orders → Trades pairing ---
// Tradovate exports individual orders. We filter "Filled" orders, sort by fill time,
// then track position per symbol to pair entries/exits into round-trip trades.
interface FilledOrder {
  symbol: string; product: string; side: 'Buy' | 'Sell'; qty: number; price: number; fillTime: string;
}

// Known futures point values
const POINT_VALUES: Record<string, number> = {
  MNQ: 2, NQ: 20, MES: 5, ES: 50, MYM: 0.5, YM: 5, M2K: 5, RTY: 50,
  MCL: 10, CL: 1000, MGC: 10, GC: 100, SI: 5000, HG: 25000,
  '6E': 125000, '6J': 12500000, '6B': 62500, ZB: 1000, ZN: 1000,
};

function getPointValue(product: string): number {
  return POINT_VALUES[product.toUpperCase()] || 1;
}

function parseTradovateOrders(headers: string[], rows: string[][]): ParsedTrade[] {
  // 1. Extract filled orders
  const filledOrders: FilledOrder[] = [];
  for (const row of rows) {
    const status = getCol(row, headers, 'Status').trim();
    if (status !== 'Filled') continue;
    const side = getCol(row, headers, 'B/S').trim() as 'Buy' | 'Sell';
    const symbol = getCol(row, headers, 'Contract');
    const product = getCol(row, headers, 'Product');
    const qty = parseNumber(getCol(row, headers, 'filledQty') || getCol(row, headers, 'Filled Qty'));
    const price = parseNumber(getCol(row, headers, 'avgPrice') || getCol(row, headers, 'Avg Fill Price'));
    const fillTime = getCol(row, headers, 'Fill Time');
    if (qty > 0 && price > 0) {
      filledOrders.push({ symbol, product, side, qty, price, fillTime });
    }
  }

  // 2. Sort by fill time
  filledOrders.sort((a, b) => new Date(a.fillTime).getTime() - new Date(b.fillTime).getTime());

  // 3. Track position per symbol and pair into trades
  const trades: ParsedTrade[] = [];
  // position > 0 = long, < 0 = short
  const positions: Record<string, { qty: number; avgPrice: number; openTime: string; product: string }> = {};

  for (const order of filledOrders) {
    const key = order.symbol || order.product;
    if (!positions[key]) positions[key] = { qty: 0, avgPrice: 0, openTime: '', product: order.product };

    const pos = positions[key];
    const orderQty = order.side === 'Buy' ? order.qty : -order.qty;
    const prevQty = pos.qty;
    const newQty = prevQty + orderQty;

    // Opening or adding to position
    if (prevQty === 0) {
      pos.qty = newQty;
      pos.avgPrice = order.price;
      pos.openTime = order.fillTime;
      pos.product = order.product;
    }
    // Same direction → average in
    else if ((prevQty > 0 && orderQty > 0) || (prevQty < 0 && orderQty < 0)) {
      pos.avgPrice = (pos.avgPrice * Math.abs(prevQty) + order.price * Math.abs(orderQty)) / (Math.abs(prevQty) + Math.abs(orderQty));
      pos.qty = newQty;
    }
    // Closing or reversing
    else {
      const closedQty = Math.min(Math.abs(prevQty), Math.abs(orderQty));
      const pv = getPointValue(pos.product);
      const entryPrice = pos.avgPrice;
      const exitPrice = order.price;
      const side = prevQty > 0 ? 'LONG' : 'SHORT';
      const pnlGross = side === 'LONG'
        ? (exitPrice - entryPrice) * closedQty * pv
        : (entryPrice - exitPrice) * closedQty * pv;

      trades.push({
        symbol: pos.product || key,
        side,
        qty: closedQty,
        entry_price: entryPrice,
        exit_price: exitPrice,
        open_time: parseDate(pos.openTime),
        close_time: parseDate(order.fillTime),
        pnl_gross: Math.round(pnlGross * 100) / 100,
        fees: 0,
        pnl_net: Math.round(pnlGross * 100) / 100,
        valid: true,
      });

      // Remainder becomes new position
      if (Math.abs(newQty) > 0) {
        pos.qty = newQty;
        // If remaining position is same direction, keep original avg price
        if ((newQty > 0 && prevQty > 0) || (newQty < 0 && prevQty < 0)) {
          // avgPrice stays the same — remaining contracts have the same cost basis
        } else {
          // Position reversed — new position starts at closing order's price
          pos.avgPrice = order.price;
          pos.openTime = order.fillTime;
        }
      } else {
        pos.qty = 0;
        pos.avgPrice = 0;
        pos.openTime = '';
      }
    }
  }

  // Warn about open positions
  Object.entries(positions).forEach(([key, pos]) => {
    if (pos.qty !== 0) {
      trades.push({
        symbol: pos.product || key, side: pos.qty > 0 ? 'LONG' : 'SHORT',
        qty: Math.abs(pos.qty), entry_price: pos.avgPrice, exit_price: 0,
        open_time: parseDate(pos.openTime), close_time: new Date().toISOString(),
        pnl_gross: 0, fees: 0, pnl_net: 0, valid: false, error: 'Open position (no exit found)',
      });
    }
  });

  return trades;
}

// --- Generic / other brokers column mapping ---
interface ColumnMapping {
  symbol: string; side: string; qty: string; entryPrice: string; exitPrice: string;
  openTime: string; closeTime: string; pnlGross: string; fees: string;
}

const BROKER_COLUMN_MAPS: Record<string, ColumnMapping> = {
  ninjatrader: { symbol: 'Instrument', side: 'Market pos.', qty: 'Qty', entryPrice: 'Entry price', exitPrice: 'Exit price', openTime: 'Entry time', closeTime: 'Exit time', pnlGross: 'Profit', fees: 'Commission' },
  tradingview: { symbol: 'Symbol', side: 'Side', qty: 'Qty', entryPrice: 'Price', exitPrice: 'Close Price', openTime: 'Date/Time', closeTime: 'Close Date/Time', pnlGross: 'Profit', fees: 'Fee' },
  metatrader: { symbol: 'Symbol', side: 'Type', qty: 'Volume', entryPrice: 'Price', exitPrice: 'S / L', openTime: 'Time', closeTime: 'Time.1', pnlGross: 'Profit', fees: 'Commission' },
  generic: { symbol: 'symbol', side: 'side', qty: 'qty', entryPrice: 'entry_price', exitPrice: 'exit_price', openTime: 'open_time', closeTime: 'close_time', pnlGross: 'pnl_gross', fees: 'fees' },
};

function mapRowGeneric(row: string[], headers: string[], mapping: ColumnMapping): ParsedTrade {
  try {
    const symbol = getCol(row, headers, mapping.symbol) || 'UNKNOWN';
    const side = normalizeSide(getCol(row, headers, mapping.side));
    const qty = Math.abs(parseNumber(getCol(row, headers, mapping.qty))) || 1;
    const entryPrice = parseNumber(getCol(row, headers, mapping.entryPrice));
    const exitPrice = parseNumber(getCol(row, headers, mapping.exitPrice));
    const openTime = parseDate(getCol(row, headers, mapping.openTime));
    const closeTime = parseDate(getCol(row, headers, mapping.closeTime));
    const pnlGross = parseNumber(getCol(row, headers, mapping.pnlGross));
    const fees = Math.abs(parseNumber(getCol(row, headers, mapping.fees)));
    const pnlNet = pnlGross - fees;
    if (symbol === 'UNKNOWN') return { symbol, side, qty, entry_price: entryPrice, exit_price: exitPrice, open_time: openTime, close_time: closeTime, pnl_gross: pnlGross, fees, pnl_net: pnlNet, valid: false, error: 'Missing symbol' };
    return { symbol, side, qty, entry_price: entryPrice, exit_price: exitPrice, open_time: openTime, close_time: closeTime, pnl_gross: pnlGross, fees, pnl_net: pnlNet, valid: true };
  } catch (e: any) {
    return { symbol: '', side: '', qty: 0, entry_price: 0, exit_price: 0, open_time: '', close_time: '', pnl_gross: 0, fees: 0, pnl_net: 0, valid: false, error: e.message };
  }
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

import { useAccounts } from '@/hooks/useAccounts';

interface ImportBatch {
  id: string;
  source: string;
  file_name: string | null;
  status: string;
  rows_count: number | null;
  created_at: string;
}

export default function JournalImport() {
  const { accounts, selectedAccountId, setSelectedAccountId } = useAccounts();
  const [step, setStep] = useState<Step>('upload');
  const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase.from('import_batches').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setImportHistory(data as unknown as ImportBatch[]);
    setLoadingHistory(false);
  }, []);

  const handleDeleteBatch = async (batchId: string) => {
    const { error: tradeErr } = await supabase.from('trades').delete().eq('import_batch_id', batchId);
    if (tradeErr) { toast.error('Failed to delete trades'); return; }
    const { error: batchErr } = await supabase.from('import_batches').delete().eq('id', batchId);
    if (batchErr) { toast.error('Failed to delete batch'); return; }
    toast.success('Import batch and trades deleted');
    fetchHistory();
  };

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  const [broker, setBroker] = useState<BrokerFormat>('auto');
  const [detectedBroker, setDetectedBroker] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: number }>({ success: 0, errors: 0 });
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) { toast.error('Only CSV files are supported'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) { toast.error('Could not parse CSV'); return; }

      const format = broker === 'auto' ? detectBroker(headers) : broker;
      setDetectedBroker(format === 'auto' ? 'generic' : format);

      let parsed: ParsedTrade[];
      if (format === 'tradovate') {
        parsed = parseTradovateOrders(headers, rows);
      } else {
        const mapping = BROKER_COLUMN_MAPS[format === 'auto' ? 'generic' : format];
        if (!mapping) { toast.error('Unknown format'); return; }
        parsed = rows.map(r => mapRowGeneric(r, headers, mapping));
      }

      setParsedTrades(parsed);
      setStep('preview');

      if (format === 'tradovate') {
        toast.success(`Detected Tradovate Orders format. Paired ${parsed.filter(t => t.valid).length} round-trip trades.`);
      } else if (format === 'auto') {
        toast.info('Could not auto-detect broker. Using generic mapping.');
      }
    };
    reader.readAsText(file);
  }, [broker]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    const validTrades = parsedTrades.filter(t => t.valid);
    if (validTrades.length === 0) { toast.error('No valid trades to import'); return; }

    setImporting(true);
    setStep('importing');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setImporting(false); setStep('preview'); return; }

    const { data: batch, error: batchErr } = await supabase.from('import_batches').insert({
      user_id: user.id, source: detectedBroker.toUpperCase() || 'CSV',
      file_name: fileName, status: 'processing', rows_count: validTrades.length,
    }).select().single();

    if (batchErr) { toast.error('Failed to create import batch'); setImporting(false); setStep('preview'); return; }

    let success = 0, errors = 0;
    const chunkSize = 50;
    for (let i = 0; i < validTrades.length; i += chunkSize) {
      const chunk = validTrades.slice(i, i + chunkSize).map(t => ({
        user_id: user.id, symbol: t.symbol, side: t.side, qty: t.qty,
        entry_price: t.entry_price, exit_price: t.exit_price,
        open_time: t.open_time, close_time: t.close_time,
        pnl_gross: t.pnl_gross, fees: t.fees, pnl_net: t.pnl_net,
        source: 'CSV', import_batch_id: batch.id,
        account_id: selectedAccountId !== 'all' ? selectedAccountId : null,
      }));
      const { error } = await supabase.from('trades').insert(chunk);
      if (error) { errors += chunk.length; } else { success += chunk.length; }
    }

    await supabase.from('import_batches').update({
      status: errors > 0 ? 'partial' : 'completed',
      completed_at: new Date().toISOString(),
      errors: errors > 0 ? { count: errors } : null,
    }).eq('id', batch.id);

    setImportResult({ success, errors });
    setImporting(false);
    setStep('done');
    toast.success(`Imported ${success} trades`);
    fetchHistory();
  };

  const reset = () => {
    setStep('upload'); setFileName(''); setParsedTrades([]);
    setImportResult({ success: 0, errors: 0 }); setDetectedBroker('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const validCount = parsedTrades.filter(t => t.valid).length;
  const invalidCount = parsedTrades.filter(t => !t.valid).length;
  const totalPnl = parsedTrades.filter(t => t.valid).reduce((sum, t) => sum + t.pnl_net, 0);

  return (
    <JournalLayout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Import Center</h1>
          <p className="text-sm text-muted-foreground">Import trades from CSV exports</p>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                  <CardDescription>Select target account for import</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name}{a.account_type !== 'personal' ? ` (${a.account_type})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Broker Format</CardTitle>
                  <CardDescription>Select your broker or leave auto-detect</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select value={broker} onValueChange={(v) => setBroker(v as BrokerFormat)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="tradovate">Tradovate</SelectItem>
                      <SelectItem value="ninjatrader">NinjaTrader</SelectItem>
                      <SelectItem value="tradingview">TradingView</SelectItem>
                      <SelectItem value="metatrader">MetaTrader</SelectItem>
                      <SelectItem value="generic">Generic CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>

            <Card
              className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <CardContent className="py-16 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Drop CSV File Here</h3>
                <p className="text-sm text-muted-foreground mb-4">or click to browse. Supports Tradovate Orders, NinjaTrader, TradingView, MetaTrader exports.</p>
                <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" />Browse Files</Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Supported Formats</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm space-y-1">
                  <p><Badge variant="outline" className="mr-2">Tradovate</Badge>Orders export — automatically pairs Buy/Sell fills into round-trip trades with P&L calculation</p>
                  <p><Badge variant="outline" className="mr-2">NinjaTrader</Badge>Trade performance export with entry/exit prices</p>
                  <p><Badge variant="outline" className="mr-2">TradingView</Badge>Strategy report CSV export</p>
                  <p><Badge variant="outline" className="mr-2">Generic</Badge>CSV with columns: symbol, side, qty, entry_price, exit_price, open_time, close_time, pnl_gross, fees</p>
                </div>
              </CardContent>
            </Card>

            {/* Import History with Delete */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import History</CardTitle>
                <CardDescription>Previous imports — delete to remove all trades from that batch</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : importHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No imports yet</p>
                ) : (
                  <div className="space-y-2">
                    {importHistory.map(batch => (
                      <div key={batch.id} className="flex items-center justify-between rounded-md border border-border p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{batch.file_name || 'Unknown file'}</p>
                            <p className="text-xs text-muted-foreground">
                              {batch.source} · {batch.rows_count || 0} trades · {new Date(batch.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={batch.status === 'completed' ? 'default' : batch.status === 'partial' ? 'secondary' : 'outline'} className="text-xs">
                            {batch.status}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Import Batch?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete all {batch.rows_count || 0} trades from "{batch.file_name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteBatch(batch.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="outline">{detectedBroker.toUpperCase()}</Badge>
                <Badge variant="secondary">{parsedTrades.length} trades</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}><X className="h-4 w-4 mr-1" />Cancel</Button>
                <Button size="sm" onClick={handleImport} disabled={validCount === 0}>
                  <ArrowRight className="h-4 w-4 mr-1" />Import {validCount} Trades
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total Trades</p><p className="font-mono font-bold text-lg">{parsedTrades.length}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Valid</p><p className="font-mono font-bold text-lg text-profit">{validCount}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Invalid</p><p className="font-mono font-bold text-lg text-loss">{invalidCount}</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Net P&L</p><p className={cn('font-mono font-bold text-lg', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>{formatCurrency(totalPnl)}</p></CardContent></Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Symbol</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Side</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Entry</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Exit</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Open</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Close</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTrades.slice(0, 100).map((t, i) => (
                        <tr key={i} className={cn('border-b border-border/50', !t.valid && 'bg-destructive/5')}>
                          <td className="px-3 py-2">
                            {t.valid ? <CheckCircle2 className="h-4 w-4 text-profit" /> : (
                              <div className="flex items-center gap-1">
                                <AlertCircle className="h-4 w-4 text-loss" />
                                {t.error && <span className="text-xs text-loss">{t.error}</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 font-medium">{t.symbol}</td>
                          <td className="px-3 py-2"><Badge variant={t.side === 'LONG' ? 'default' : 'secondary'} className="text-xs">{t.side}</Badge></td>
                          <td className="px-3 py-2 text-right font-mono">{t.qty}</td>
                          <td className="px-3 py-2 text-right font-mono">{t.entry_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{t.exit_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.open_time).toLocaleString()}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{new Date(t.close_time).toLocaleString()}</td>
                          <td className={cn('px-3 py-2 text-right font-mono font-semibold', t.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>
                            {t.pnl_net >= 0 ? '+' : ''}{formatCurrency(t.pnl_net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedTrades.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground py-3">Showing first 100 of {parsedTrades.length} trades</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === 'importing' && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-1">Importing Trades...</h3>
              <p className="text-sm text-muted-foreground">Processing {validCount} trades from {fileName}</p>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {step === 'done' && (
          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <CheckCircle2 className="h-12 w-12 mx-auto text-profit mb-4" />
              <h3 className="text-lg font-semibold">Import Complete</h3>
              <div className="flex items-center justify-center gap-6">
                <div><p className="text-2xl font-bold text-profit">{importResult.success}</p><p className="text-xs text-muted-foreground">Imported</p></div>
                {importResult.errors > 0 && <div><p className="text-2xl font-bold text-loss">{importResult.errors}</p><p className="text-xs text-muted-foreground">Failed</p></div>}
              </div>
              <div className="flex justify-center gap-2 pt-4">
                <Button variant="outline" onClick={reset}><Upload className="h-4 w-4 mr-1" />Import More</Button>
                <Button onClick={() => window.location.href = '/journal/trades'}><ArrowRight className="h-4 w-4 mr-1" />View Trades</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </JournalLayout>
  );
}
