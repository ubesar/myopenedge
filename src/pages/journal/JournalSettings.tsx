import { JournalLayout } from '@/components/journal/JournalLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function JournalSettings() {
  return (
    <JournalLayout>
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Journal settings - coming in next update</p>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Settings page will be built next.</CardContent></Card>
      </div>
    </JournalLayout>
  );
}
