import { useState } from "react";
import {
  getPageDataSource,
  setPageDataSource,
  getDataSourceMode,
  type DataSourceScope,
  type PageDataSource,
} from "@/lib/data-source";

const OPTIONS: { value: PageDataSource; label: string }[] = [
  { value: "default", label: "ikuti global" },
  { value: "auto", label: "otomatis" },
  { value: "stored", label: "data tersimpan" },
  { value: "live", label: "live api" },
];

interface Props {
  scope: DataSourceScope;
  /** dark toolbar styling (chart page) */
  dark?: boolean;
  className?: string;
}

const DataSourceToggle = ({ scope, dark = false, className = "" }: Props) => {
  const [value, setValue] = useState<PageDataSource>(getPageDataSource(scope));

  const pick = (v: PageDataSource) => {
    setPageDataSource(scope, v);
    setValue(v);
  };

  const globalLabel = getDataSourceMode();

  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      <span className={`text-[11px] lowercase ${dark ? "text-gray-500" : "text-muted-foreground"}`}>
        data
      </span>
      {OPTIONS.map((o) => {
        const active = value === o.value;
        if (dark) {
          return (
            <button
              key={o.value}
              onClick={() => pick(o.value)}
              title={o.value === "default" ? `global: ${globalLabel}` : undefined}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors shrink-0 ${
                active ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
              style={active ? { background: "#2962FF" } : {}}
            >
              {o.label}
            </button>
          );
        }
        return (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            title={o.value === "default" ? `global: ${globalLabel}` : undefined}
            className={`px-2 py-0.5 rounded-md text-[11px] lowercase transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

export default DataSourceToggle;
