export default function StatsGrid({ stats, isMobile }) {
  const items = [
    { l: "Total Apps", v: stats.total, c: "#e4e4e7" },
    { l: "Live", v: stats.live, c: "#22c55e" },
    { l: "In Review", v: stats.review, c: "#f59e0b" },
    { l: "In Progress", v: stats.prep, c: "#f59e0b" },
  ];

  return (
    <div className={`grid gap-2.5 ${isMobile ? "grid-cols-2 gap-2 mb-4" : "grid-cols-4 mb-6"}`}>
      {items.map((s, i) => (
        <div
          key={i}
          className={`bg-dark-card border border-dark-border rounded-xl ${isMobile ? "px-3.5 py-3" : "px-[18px] py-4"}`}
        >
          <div className="text-[10.5px] text-dark-faint font-bold tracking-wide uppercase">
            {s.l}
          </div>
          <div
            className={`font-extrabold tracking-tight mt-1 ${isMobile ? "text-[22px]" : "text-[26px]"}`}
            style={{ color: s.c }}
          >
            {s.v}
          </div>
        </div>
      ))}
    </div>
  );
}
