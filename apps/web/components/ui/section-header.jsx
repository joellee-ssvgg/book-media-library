function SectionHeader({ eyebrow, title, action, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="ink-eyebrow">{eyebrow}</p>}
        <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-[var(--ink)] sm:text-4xl">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {children}
    </div>
  );
}

export { SectionHeader };
