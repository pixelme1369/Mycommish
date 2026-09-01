"use client";

import { useActionState, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { saveMonthlyGoalAction, type SaveGoalResult } from "@/app/portal/goal-actions";
import type { EnrolledGoalView } from "@/lib/portal/monthly-goal";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  bandRange,
  commissionBandsForAgent,
  enrollmentPayPreview,
} from "@/lib/portal/goal-tier-estimate";
import {
  applyClearRate,
  DEBT_GOAL_PRESETS,
  DEFAULT_CLEAR_RATE_PCT,
  formatDebtInputDisplay,
  formatDebtTyping,
} from "@/lib/portal/monthly-goal-math";

function moneyHero(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatPct(n: number) {
  if (n <= 0) return "0%";
  if (n < 10) return `${n.toFixed(1)}%`;
  return `${Math.round(n)}%`;
}

function compactRate(fraction: number) {
  const p = fraction * 100;
  return Number.isInteger(p) ? `${p}%` : `${p.toFixed(2)}%`;
}

function formatClearPct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(DEFAULT_CLEAR_RATE_PCT);
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function DebtGoalCombobox({
  id,
  name,
  value,
  onChange,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [usingKeys, setUsingKeys] = useState(false);

  function pick(amount: number) {
    onChange(formatDebtInputDisplay(amount));
    setOpen(false);
    setUsingKeys(false);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        inputMode="decimal"
        placeholder="$1,000,000"
        value={value}
        onChange={(e) => {
          onChange(formatDebtTyping(e.target.value));
          setOpen(true);
          setHighlight(0);
          setUsingKeys(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!open) {
            if (e.key === "ArrowDown") setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setUsingKeys(true);
            setHighlight((h) => Math.min(h + 1, DEBT_GOAL_PRESETS.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setUsingKeys(true);
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && usingKeys) {
            const preset = DEBT_GOAL_PRESETS[highlight];
            if (preset) {
              e.preventDefault();
              pick(preset.value);
            }
          }
        }}
        className="h-10 pr-9 tabular-nums"
        aria-label="Monthly enrolled dollar goal"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Show dollar presets"
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-9 items-center justify-center"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="bg-popover text-popover-foreground absolute z-50 mt-1 w-full overflow-hidden rounded-xl py-1 shadow-lg ring-1 ring-foreground/10"
        >
          {DEBT_GOAL_PRESETS.map((preset, i) => (
            <li key={preset.value}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-sm tabular-nums",
                  i === highlight ? "bg-muted text-foreground" : "hover:bg-muted/70",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(preset.value)}
              >
                <span>{preset.label}</span>
                <span className="text-muted-foreground text-xs">
                  {formatDebtInputDisplay(preset.value)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const size = 112;
  const stroke = 7;
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  const dash = (p / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.96 0.02 150 / 0.16)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="oklch(0.82 0.17 150)"
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-heading text-lg leading-none tracking-tight text-[oklch(0.97_0.02_150)] tabular-nums">
          {formatPct(p)}
        </span>
      </div>
    </div>
  );
}

function GoalForm({
  view,
  compact,
}: {
  view: EnrolledGoalView;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveMonthlyGoalAction,
    null as SaveGoalResult | null,
  );
  const [debtRaw, setDebtRaw] = useState(
    view.debtGoal > 0 ? formatDebtInputDisplay(view.debtGoal) : "",
  );
  const [dailyRaw, setDailyRaw] = useState(
    view.enteredDailyUnits != null ? String(view.enteredDailyUnits) : "",
  );

  return (
    <form action={action} className={compact ? "mt-6" : "mt-0"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="debtGoal" className="text-muted-foreground">
            Enrolled $ this month
          </Label>
          <DebtGoalCombobox
            id="debtGoal"
            name="debtGoal"
            value={debtRaw}
            onChange={setDebtRaw}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitsPerDay" className="text-muted-foreground">
            Units per working day
          </Label>
          <Input
            id="unitsPerDay"
            name="unitsPerDay"
            inputMode="numeric"
            placeholder="Optional — e.g. 2"
            value={dailyRaw}
            onChange={(e) => setDailyRaw(e.target.value)}
            className="h-10"
            aria-label="Units per working day"
          />
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Dollar goal drives the ring. Units/day is optional — otherwise we size
        units from your average enrolled file and {view.workingDaysTotal} working
        days in {view.monthTitle}.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : view.hasGoal ? "Update goal" : "Set goal"}
        </Button>
        {state && !state.ok ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
      </div>
    </form>
  );
}

function GoalTierPanel({
  view,
  agentName,
  clearPct,
}: {
  view: EnrolledGoalView;
  agentName: string | null;
  clearPct: number;
}) {
  const enrolledNow = applyClearRate(view.unitsActual, view.debtActual, clearPct);
  const enrolledGoal = applyClearRate(
    view.unitsGoal > 0 ? view.unitsGoal : view.unitsActual,
    view.debtGoal > 0 ? view.debtGoal : view.debtActual,
    clearPct,
  );
  const now = enrollmentPayPreview(agentName, enrolledNow.units, enrolledNow.debt);
  const atGoal = enrollmentPayPreview(
    agentName,
    enrolledGoal.units,
    enrolledGoal.debt,
  );
  const bands = commissionBandsForAgent(agentName);
  const showGoal =
    view.unitsGoal > 0 &&
    (view.unitsGoal !== view.unitsActual || view.debtGoal !== view.debtActual);
  const enrolledGoalUnits = view.unitsGoal > 0 ? view.unitsGoal : view.unitsActual;

  return (
    <aside className="h-full rounded-3xl bg-[oklch(0.985_0.014_150)] px-6 py-6 ring-1 ring-primary/15">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-primary uppercase">
        If {formatClearPct(clearPct)}% clear
      </p>
      <p className="mt-5 text-[11px] tracking-wide text-muted-foreground">Now</p>
      <p className="font-heading mt-1 text-2xl tracking-tight tabular-nums">
        {now.pay > 0 ? money(now.pay) : "—"}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {view.unitsActual} enrolled · ~{now.units} clear
        {now.rate > 0 ? ` · ${compactRate(now.rate)}` : ""}
      </p>
      {showGoal ? (
        <>
          <p className="mt-5 text-[11px] tracking-wide text-muted-foreground">
            At goal
          </p>
          <p className="font-heading mt-1 text-2xl tracking-tight text-primary tabular-nums">
            {atGoal.pay > 0 ? moneyHero(atGoal.pay) : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enrolledGoalUnits} enrolled · ~{atGoal.units} clear ·{" "}
            {compactRate(atGoal.rate)}
          </p>
        </>
      ) : null}

      <ul className="mt-6 space-y-1.5 border-t border-primary/10 pt-5">
        {bands.map((band, i) => {
          const tier = i + 1;
          const isNow = !now.fixed && now.tier === tier;
          const isGoal = showGoal && !atGoal.fixed && atGoal.tier === tier;
          return (
            <li
              key={band.label}
              className={cn(
                "flex items-baseline justify-between gap-3 text-[13px] tabular-nums",
                isNow || isGoal ? "text-foreground" : "text-muted-foreground/80",
              )}
            >
              <span>
                {bandRange(band)}
                {isNow ? (
                  <span className="ml-1.5 text-[10px] tracking-wide text-primary uppercase">
                    now
                  </span>
                ) : null}
                {isGoal && !isNow ? (
                  <span className="ml-1.5 text-[10px] tracking-wide text-primary uppercase">
                    goal
                  </span>
                ) : null}
              </span>
              <span>{compactRate(band.rate)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
        {now.fixed
          ? `Flat ${compactRate(now.rate)} on the ${formatClearPct(clearPct)}% expected to clear. Units don’t change the rate.`
          : `Estimate: ${formatClearPct(clearPct)}% of enrolled $ × your rate. Real pay still uses clawbacks and cancel rate.`}
      </p>
    </aside>
  );
}

export function MonthlyGoalDashboard({
  view,
  agentName,
  showPayPreview = true,
}: {
  view: EnrolledGoalView;
  agentName: string | null;
  showPayPreview?: boolean;
}) {
  const [editing, setEditing] = useState(!view.hasGoal);
  const panelClearPct = view.clearRatePct || DEFAULT_CLEAR_RATE_PCT;
  const completePct =
    view.debtGoal > 0
      ? (view.debtActual / view.debtGoal) * 100
      : view.unitsGoal > 0
        ? (view.unitsActual / view.unitsGoal) * 100
        : 0;
  const hero =
    view.debtGoal > 0
      ? moneyHero(view.debtGoal)
      : view.unitsGoal > 0
        ? `${view.unitsGoal} units`
        : null;

  const remainingLabel =
    view.workingDaysLeft > 0
      ? `${view.workingDaysLeft} of ${view.workingDaysTotal} working days left`
      : `${view.workingDaysTotal} working days`;

  return (
    <div
      className={
        showPayPreview
          ? "lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch lg:gap-5"
          : undefined
      }
    >
      <div className="min-w-0">
        <div
          className="overflow-hidden rounded-3xl text-[oklch(0.96_0.02_150)] shadow-[0_28px_70px_-32px_oklch(0.28_0.08_150/0.55)]"
          style={{
            background:
              "radial-gradient(820px 380px at -8% -20%, oklch(0.40 0.10 150 / 0.85), transparent 58%), oklch(0.22 0.048 150)",
          }}
        >
          <div className="flex flex-col gap-8 px-7 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-9 sm:py-9">
            <header className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[oklch(0.82_0.14_150)] uppercase">
                {view.monthTitle.replace(/ \d+$/, "")} goal
              </p>
              {hero ? (
                <p className="font-heading mt-4 text-[2.65rem] leading-none tracking-tight text-[oklch(0.98_0.015_150)] tabular-nums sm:text-6xl">
                  {hero}
                </p>
              ) : (
                <p className="font-heading mt-4 text-4xl tracking-tight text-[oklch(0.98_0.015_150)] sm:text-5xl">
                  Set this month
                </p>
              )}
              <p className="mt-3 text-sm text-[oklch(0.86_0.04_150)]">
                {remainingLabel}
                {view.avgDeal > 0 ? ` · avg ${moneyHero(view.avgDeal)}` : ""}
              </p>
            </header>

            {view.hasGoal ? (
              <div className="flex shrink-0 items-center gap-4">
                <Ring pct={completePct} />
                <div className="min-w-0">
                  <p className="text-sm text-[oklch(0.96_0.02_150)]">
                    <span className="font-medium tabular-nums">{view.dailyPace}</span>
                    {" "}
                    a day to hit it
                  </p>
                  <p className="mt-0.5 text-sm text-[oklch(0.78_0.05_150)]">
                    {view.enrolledToday} enrolled today
                    {view.enteredDailyUnits != null
                      ? ` · set ${view.enteredDailyUnits}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {view.hasGoal ? (
            <div className="grid grid-cols-2 gap-6 border-t border-[oklch(0.96_0.02_150/0.1)] bg-[oklch(0.16_0.04_150/0.45)] px-7 py-5 sm:px-9">
              <div>
                <p className="text-[11px] tracking-wide text-[oklch(0.78_0.06_150)]">
                  Units left
                </p>
                <p className="font-heading mt-1.5 text-2xl tracking-tight tabular-nums">
                  {view.unitsGoal > 0 ? view.unitsRemaining : view.unitsActual}
                  {view.unitsGoal > 0 ? (
                    <span className="text-base font-normal text-[oklch(0.78_0.06_150)]">
                      {" "}
                      / {view.unitsGoal}
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-[11px] tracking-wide text-[oklch(0.78_0.06_150)]">
                  Enrolled $ left
                </p>
                <p className="font-heading mt-1.5 text-2xl tracking-tight tabular-nums">
                  {view.debtGoal > 0
                    ? moneyHero(view.debtRemaining)
                    : moneyHero(view.debtActual)}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {view.hasGoal ? (
          <div className="mt-5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? "Done" : "Edit goal"}
            </Button>
            {editing ? (
              <div className="mt-3 rounded-3xl bg-card/90 px-6 py-6 ring-1 ring-border/70">
                <GoalForm view={view} compact />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-3xl bg-card/90 px-6 py-6 ring-1 ring-border/70 sm:px-8">
            <GoalForm view={view} />
          </div>
        )}
      </div>

      {view.hasGoal && showPayPreview ? (
        <div className="mt-5 lg:mt-0">
          <GoalTierPanel
            view={view}
            agentName={agentName}
            clearPct={panelClearPct}
          />
        </div>
      ) : null}
    </div>
  );
}
