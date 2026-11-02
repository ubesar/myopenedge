import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { HardDrive, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  deleteLocalDataset, listLocalDatasets, minuteToLabel, saveLocalDataset, type LocalDatasetMeta,
} from "@/lib/local-m1-store";
import type { M1Series } from "@/lib/seasonal-window";

interface Props {
  selected?: string | null;
  onSelect?: (name: string) => void;
  onChange?: (list: LocalDatasetMeta[]) => void;
}

/** Import NinjaTrader M1 CSV into local browser storage + manage saved datasets. */
export default function LocalM1Panel({ selected, onSelect, onChange }: Props) {
  const [list, setList] = useState<LocalDatasetMeta[]>([]);
  const [name, setName] = useState("NQ_M1");
  const [pct, setPct] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const l = await listLocalDatasets();
    setList(l);
    onChange?.(l);
  };
  useEffect(() => { refresh(); }, []);

  const importFile = (file: File) => {
    const dsName = name.trim() || file.name.replace(/\.csv$/i, "");
    setPct(0);
    const w = new Worker(new URL("../workers/m1-csv.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = async (ev) => {
      const m = ev.data;
      if (m.type === "progress") setPct(m.pct);
      else if (m.type === "error") { toast.error(m.message); setPct(null); w.terminate(); }
      else if (m.type === "done") {
        w.terminate();
        try {
          await saveLocalDataset(dsName, m.series as M1Series);
          toast.success(`${dsName}: ${(m.series.t.length as number).toLocaleString()} bar tersimpan`);
          await refresh();
          onSelect?.(dsName);
        } catch (e: any) {
          toast.error(e?.message || "gagal menyimpan");
        }
        setPct(null);
      }
    };
    w.postMessage({ file });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-primary" />
        <h2 className="font-semibold lowercase">local m1 datasets (ninjatrader)</h2>
      </div>
      <p className="text-xs text-muted-foreground lowercase">
        disimpan di browser ini (bukan server). file besar (ratusan mb) cukup diimport sekali. format: time,open,high,low,close — waktu et, bar diberi label saat close.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Input className="w-40" value={name} onChange={(e) => setName(e.target.value)} placeholder="nama dataset" />
        <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
        <Button size="sm" disabled={pct !== null} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> import csv
        </Button>
      </div>
      {pct !== null && (
        <div className="space-y-1">
          <Progress value={pct} />
          <p className="text-xs text-muted-foreground">memproses… {pct}%</p>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground lowercase">belum ada dataset.</p>
      ) : (
        <div className="space-y-1">
          {list.map((d) => (
            <div key={d.name}
              className={`flex items-center justify-between gap-2 rounded border px-3 py-2 text-xs ${selected === d.name ? "border-primary" : "border-border"}`}>
              <button className="text-left flex-1" onClick={() => onSelect?.(d.name)}>
                <div className="font-medium">{d.name}</div>
                <div className="text-muted-foreground">
                  {d.bars.toLocaleString()} bar · {minuteToLabel(d.first)} → {minuteToLabel(d.last)}
                </div>
              </button>
              <Button size="icon" variant="ghost" aria-label={`hapus ${d.name}`}
                onClick={async () => { await deleteLocalDataset(d.name); refresh(); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
