import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function JournalPlaybooks() {
  return (
    <JournalLayout>
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Playbooks</h1>
        <p className="text-muted-foreground">Manage trading strategies - coming in next update</p>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Playbooks page will be built next.</CardContent></Card>
      </div>
    </JournalLayout>
  );
}
