export default function Legend({ events }) {
  const seen = new Map();
  for (const ev of events) {
    if (!seen.has(ev.category)) {
      seen.set(ev.category, ev.categoryColor);
    }
  }

  return (
    <div className="footer">
      <div className="legend">
        {Array.from(seen.entries()).map(([category, color]) => (
          <div className="legend-item" key={category}>
            <span className="swatch" style={{ background: color }} />
            {category}
          </div>
        ))}
      </div>
    </div>
  );
}
