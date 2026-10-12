/** Tiny dependency-free SVG charts for the admin pages. */
export function Bars({ values, labels, color = "#6366f1", height = 140, format }: { values: number[]; labels: string[]; color?: string; height?: number; format?: (n: number) => string }) {
  const w = 700;
  const max = Math.max(...values, 1);
  const bw = w / Math.max(values.length, 1);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Bar chart">
      {values.map((v, i) => {
        const h = v ? Math.max((v / max) * (height - 6), 3) : 1.5;
        return (
          <rect key={i} x={i * bw + bw * 0.14} y={height - h} width={bw * 0.72} height={h} rx={2} fill={color} opacity={v ? 1 : 0.22}>
            <title>{`${labels[i]}: ${format ? format(v) : v}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function HBars({ rows, color = "#6366f1" }: { rows: [string, number][]; color?: string }) {
  const max = Math.max(...rows.map((r) => r[1]), 1);
  if (!rows.length) return <s-text color="subdued">No data yet.</s-text>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map(([label, n]) => (
        <div key={label} style={{ display: "grid", gridTemplateColumns: "150px 1fr 44px", gap: 10, alignItems: "center", fontSize: 13 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          <span style={{ background: "#e5e7eb", borderRadius: 99, height: 8, overflow: "hidden" }}>
            <i style={{ display: "block", height: "100%", width: `${(n / max) * 100}%`, background: color }} />
          </span>
          <b style={{ textAlign: "right" }}>{n}</b>
        </div>
      ))}
    </div>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-text color="subdued">{label}</s-text>
      <s-heading>{String(value)}</s-heading>
      {hint && <s-text color="subdued">{hint}</s-text>}
    </s-box>
  );
}
