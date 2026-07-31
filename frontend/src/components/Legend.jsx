export default function Legend({ events, hiddenCategories, onToggle }) {
  const seen = new Map();
  for (const ev of events) {
    if (!seen.has(ev.category)) {
      seen.set(ev.category, ev.categoryColor);
    }
  }

  return (
    <div className="footer">
      <div className="legend">
        {Array.from(seen.entries()).map(([category, color]) => {
          const locked = category === "Personal";
          const hidden = hiddenCategories?.has(category);
          return (
            <button
              type="button"
              className={`legend-item${hidden ? " legend-item-hidden" : ""}${locked ? " legend-item-locked" : ""}`}
              key={category}
              onClick={() => onToggle?.(category)}
              disabled={locked}
            >
              <span className="swatch" style={{ background: color }} />
              {category}
            </button>
          );
        })}
      </div>
    </div>
  );
}
