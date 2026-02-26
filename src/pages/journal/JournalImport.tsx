import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function JournalImport() {
  return (
    <JournalLayout>
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Import Center</h1>
        <p className="text-muted-foreground">Import trades from CSV or screenshots - coming in next update</p>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Import page will be built next.</CardContent></Card>
      </div>
    </JournalLayout>
  );
}
