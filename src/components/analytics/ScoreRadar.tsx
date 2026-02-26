import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ScoreComponents } from '@/lib/analytics-helpers';

interface ScoreRadarProps {
  scores: ScoreComponents;
}

export function ScoreRadar({ scores }: ScoreRadarProps) {
  const data = [
    { metric: 'Win Rate', value: scores.winRate, fullMark: 100 },
    { metric: 'Profit Factor', value: scores.profitFactor, fullMark: 100 },
    { metric: 'Consistency', value: scores.consistency, fullMark: 100 },
    { metric: 'Drawdown', value: scores.drawdown, fullMark: 100 },
    { metric: 'Expectancy', value: scores.expectancy, fullMark: 100 },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Your Score</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex flex-col items-center">
          <div className="text-4xl font-bold text-primary mb-2">{Math.round(scores.overall)}</div>
          <div className="text-xs text-muted-foreground mb-4">out of 100</div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
