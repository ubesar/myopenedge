import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function JournalAnalytics() {
  return (
    <JournalLayout>
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Analytics with calendar - coming in next update</p>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Analytics page will be built next.</CardContent></Card>
      </div>
    </JournalLayout>
  );
}
