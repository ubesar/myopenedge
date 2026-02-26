import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Placeholder - will be fully built in next iteration
export default function JournalTrades() {
  return (
    <JournalLayout>
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Trades</h1>
        <p className="text-muted-foreground">Trade journal - coming in next update</p>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Trades page will be built next. Navigate to Dashboard to see your performance.</CardContent></Card>
      </div>
    </JournalLayout>
  );
}
