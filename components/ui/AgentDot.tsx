export function AgentDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{ background: color, width: size, height: size }}
    />
  );
}

/** The house mark's window: four rounded squares. `lit` plays the lights-on motion. */
export function WindowMark({ size = 20, lit = true }: { size?: number; lit?: boolean }) {
  const cell = size / 2 - 1;
  return (
    <span
      aria-hidden
      className={`inline-grid grid-cols-2 gap-[2px] ${lit ? 'lights-on' : ''}`}
      style={{ width: size }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="rounded-[3px] bg-window" style={{ width: cell, height: cell }} />
      ))}
    </span>
  );
}
