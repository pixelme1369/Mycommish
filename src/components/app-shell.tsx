import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-60" />
      <main
        className={cn(
          "relative mx-auto w-full px-6 py-10 sm:py-12",
          wide ? "max-w-7xl" : "max-w-3xl",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="font-heading text-3xl tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <div className="max-w-2xl text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <h2 className="font-heading text-xl tracking-tight">{children}</h2>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
