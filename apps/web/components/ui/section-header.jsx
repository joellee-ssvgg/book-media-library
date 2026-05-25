function SectionHeader({ eyebrow, title, action, children }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="meta-label text-[10px] text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {children}
    </div>
  );
}

export { SectionHeader };
