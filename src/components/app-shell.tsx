import { cn } from "@/lib/utils";
import { StopImpersonationBanner } from "@/components/impersonation";

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
    <>
      <StopImpersonationBanner />
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
    </>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  compact,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Tighter title for operational screens (portal period detail, etc.). */
  compact?: boolean;
}) {
  return (
    <header className={cn(compact ? "space-y-2" : "space-y-3")}>
      {eyebrow || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {eyebrow ? (
            <p className="text-sm text-muted-foreground">{eyebrow}</p>
          ) : null}
          {actions ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2",
                !eyebrow && "ml-auto",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("min-w-0", compact ? "space-y-1" : "space-y-1.5")}>
        <h1
          className={cn(
            "font-heading tracking-tight text-foreground",
            compact ? "text-2xl sm:text-[1.65rem]" : "text-3xl sm:text-4xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <div className="max-w-2xl text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
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
