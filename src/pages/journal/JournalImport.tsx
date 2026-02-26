import { useState, useCallback, useRef } from 'react';
import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/trading-data';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, X, Download, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

type BrokerFormat = 'auto' | 'tradovate' | 'ninjatrader' | 'tradingview' | 'metatrader' | 'generic';

interface ColumnMapping {
  symbol: string; side: string; qty: string; entryPrice: string; exitPrice: string;
  openTime: string; closeTime: string; pnlGross: string; fees: string;
}

interface ParsedTrade {
  symbol: string; side: string; qty: number; entry_price: number; exit_price: number;
  open_time: string; close_time: string; pnl_gross: number; fees: number; pnl_net: number;
  valid: boolean; error?: string;
}

const BROKER_COLUMN_MAPS: Record<string, ColumnMapping> = {
  tradovate: { symbol: 'Contract', side: 'B/S', qty: 'Qty', entryPrice: 'Avg Price', exitPrice: 'Avg Price', openTime: 'Date/Time', closeTime: 'Date/Time', pnlGross: 'Profit/Loss', fees: 'Total Cost' },
  ninjatrader: { symbol: 'Instrument', side: 'Market pos.', qty: 'Qty', entryPrice: 'Entry price', exitPrice: 'Exit price', openTime: 'Entry time', closeTime: 'Exit time', pnlGross: 'Profit', fees: 'Commission' },
  tradingview: { symbol: 'Symbol', side: 'Side', qty: 'Qty', entryPrice: 'Price', exitPrice: 'Close Price', openTime: 'Date/Time', closeTime: 'Close Date/Time', pnlGross: 'Profit', fees: 'Fee' },
  metatrader: { symbol: 'Symbol', side: 'Type', qty: 'Volume', entryPrice: 'Price', exitPrice: 'S / L', openTime: 'Time', closeTime: 'Time.1', pnlGross: 'Profit', fees: 'Commission' },
  generic: { symbol: 'symbol', side: 'side', qty: 'qty', entryPrice: 'entry_price', exitPrice: 'exit_price', openTime: 'open_time', closeTime: 'close_time', pnlGross: 'pnl_gross', fees: 'fees' },
};

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

function detectBroker(headers: string[]): BrokerFormat {
  const h = headers.map(x => x.toLowerCase());
  if (h.includes('contract') && h.includes('b/s')) return 'tradovate';
  if (h.includes('instrument') && h.includes('market pos.')) return 'ninjatrader';
  if (h.includes('symbol') && h.includes('side') && h.includes('close price')) return 'tradingview';
  if (h.includes('symbol') && h.includes('type') && h.includes('volume')) return 'metatrader';
  if (h.includes('symbol') && h.includes('side') && h.includes('entry_price')) return 'generic';
  return 'auto';
}

function getColValue(row: string[], headers: string[], colName: string): string {
  const idx = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
  return idx >= 0 ? row[idx] || '' : '';
}

function normalizeSide(s: string): string {
  const lower = s.toLowerCase().trim();
  if (['buy', 'long', 'b'].includes(lower)) return 'LONG';
  if (['sell', 'short', 's'].includes(lower)) return 'SHORT';
  return s.toUpperCase();
}

function parseNumber(s: string): number {
  const cleaned = s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseDate(s: string): string {
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function mapRow(row: string[], headers: string[], mapping: ColumnMapping): ParsedTrade {
  try {
    const symbol = getColValue(row, headers, mapping.symbol) || 'UNKNOWN';
    const side = normalizeSide(getColValue(row, headers, mapping.side));
    const qty = Math.abs(parseNumber(getColValue(row, headers, mapping.qty))) || 1;
    const entryPrice = parseNumber(getColValue(row, headers, mapping.entryPrice));
    const exitPrice = parseNumber(getColValue(row, headers, mapping.exitPrice));
    const openTime = parseDate(getColValue(row, headers, mapping.openTime));
    const closeTime = parseDate(getColValue(row, headers, mapping.closeTime));
    const pnlGross = parseNumber(getColValue(row, headers, mapping.pnlGross));
    const fees = Math.abs(parseNumber(getColValue(row, headers, mapping.fees)));
    const pnlNet = pnlGross - fees;

    if (!symbol || symbol === 'UNKNOWN') return { symbol, side, qty, entry_price: entryPrice, exit_price: exitPrice, open_time: openTime, close_time: closeTime, pnl_gross: pnlGross, fees, pnl_net: pnlNet, valid: false, error: 'Missing symbol' };

    return { symbol, side, qty, entry_price: entryPrice, exit_price: exitPrice, open_time: openTime, close_time: closeTime, pnl_gross: pnlGross, fees, pnl_net: pnlNet, valid: true };
  } catch (e: any) {
    return { symbol: '', side: '', qty: 0, entry_price: 0, exit_price: 0, open_time: '', close_time: '', pnl_gross: 0, fees: 0, pnl_net: 0, valid: false, error: e.message };
  }
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

export default function JournalImport() {
  const [step, setStep] = useState<Step>('upload');
  const [broker, setBroker] = useState<BrokerFormat>('auto');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
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
      const { headers: h, rows } = parseCSV(text);
      if (h.length === 0) { toast.error('Could not parse CSV'); return; }
      setHeaders(h);

      const detectedBroker = broker === 'auto' ? detectBroker(h) : broker;
      if (detectedBroker === 'auto') {
        toast.info('Could not auto-detect broker format. Using generic mapping.');
      }
      const mapping = BROKER_COLUMN_MAPS[detectedBroker === 'auto' ? 'generic' : detectedBroker];
      const parsed = rows.map(r => mapRow(r, h, mapping));
      setParsedTrades(parsed);
      setStep('preview');
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

    // Create import batch
    const { data: batch, error: batchErr } = await supabase.from('import_batches').insert({
      user_id: user.id, source: broker === 'auto' ? 'CSV' : broker.toUpperCase(),
      file_name: fileName, status: 'processing', rows_count: validTrades.length,
    }).select().single();

    if (batchErr) { toast.error('Failed to create import batch'); setImporting(false); setStep('preview'); return; }

    let success = 0, errors = 0;
    // Insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < validTrades.length; i += chunkSize) {
      const chunk = validTrades.slice(i, i + chunkSize).map(t => ({
        user_id: user.id,
        symbol: t.symbol, side: t.side, qty: t.qty,
        entry_price: t.entry_price, exit_price: t.exit_price,
        open_time: t.open_time, close_time: t.close_time,
        pnl_gross: t.pnl_gross, fees: t.fees, pnl_net: t.pnl_net,
        source: 'CSV', import_batch_id: batch.id,
      }));
      const { error } = await supabase.from('trades').insert(chunk);
      if (error) { errors += chunk.length; } else { success += chunk.length; }
    }

    // Update batch status
    await supabase.from('import_batches').update({
      status: errors > 0 ? 'partial' : 'completed',
      completed_at: new Date().toISOString(),
      errors: errors > 0 ? { count: errors } : null,
    }).eq('id', batch.id);

    setImportResult({ success, errors });
    setImporting(false);
    setStep('done');
    toast.success(`Imported ${success} trades`);
  };

  const reset = () => {
    setStep('upload'); setFileName(''); setHeaders([]); setParsedTrades([]);
    setImportResult({ success: 0, errors: 0 });
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
            <Card>
              <CardHeader>
                <CardTitle>Broker Format</CardTitle>
                <CardDescription>Select your broker or leave auto-detect</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={broker} onValueChange={(v) => setBroker(v as BrokerFormat)}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
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

            <Card
              className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <CardContent className="py-16 text-center">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Drop CSV File Here</h3>
                <p className="text-sm text-muted-foreground mb-4">or click to browse. Supports Tradovate, NinjaTrader, TradingView, MetaTrader exports.</p>
                <Button variant="outline" size="sm"><FileText className="h-4 w-4 mr-1" />Browse Files</Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Generic CSV Format</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">If your broker isn't listed, use a CSV with these columns:</p>
                <code className="text-xs bg-secondary/50 px-2 py-1 rounded block overflow-x-auto">
                  symbol, side, qty, entry_price, exit_price, open_time, close_time, pnl_gross, fees
                </code>
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
                <Badge variant="outline">{parsedTrades.length} rows</Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}><X className="h-4 w-4 mr-1" />Cancel</Button>
                <Button size="sm" onClick={handleImport} disabled={validCount === 0}>
                  <ArrowRight className="h-4 w-4 mr-1" />Import {validCount} Trades
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Total Rows</p><p className="font-mono font-bold text-lg">{parsedTrades.length}</p></CardContent></Card>
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
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">P&L</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Fees</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTrades.slice(0, 100).map((t, i) => (
                        <tr key={i} className={cn('border-b border-border/50', !t.valid && 'bg-destructive/5')}>
                          <td className="px-3 py-2">
                            {t.valid ? <CheckCircle2 className="h-4 w-4 text-profit" /> : <AlertCircle className="h-4 w-4 text-loss" />}
                          </td>
                          <td className="px-3 py-2 font-medium">{t.symbol}</td>
                          <td className="px-3 py-2"><Badge variant={t.side === 'LONG' ? 'default' : 'secondary'} className="text-xs">{t.side}</Badge></td>
                          <td className="px-3 py-2 text-right font-mono">{t.qty}</td>
                          <td className="px-3 py-2 text-right font-mono">{t.entry_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{t.exit_price.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCurrency(t.pnl_gross)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatCurrency(t.fees)}</td>
                          <td className={cn('px-3 py-2 text-right font-mono font-semibold', t.pnl_net >= 0 ? 'text-profit' : 'text-loss')}>
                            {formatCurrency(t.pnl_net)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedTrades.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground py-3">Showing first 100 of {parsedTrades.length} rows</p>
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
