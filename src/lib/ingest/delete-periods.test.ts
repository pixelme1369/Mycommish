import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";
import { deleteOpenCalculatedPeriods, deletePeriodsByIds } from "./delete-periods";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      commissionPeriod: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      commissionAdvance: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      ledgerEntry: { deleteMany: vi.fn() },
      clientEvent: { deleteMany: vi.fn() },
      agentPeriod: { deleteMany: vi.fn() },
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

describe("deleteOpenCalculatedPeriods", () => {
  const asOf = new Date("2026-09-05T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.commissionAdvance.findMany.mockResolvedValue([]);
    prismaMock.commissionAdvance.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.ledgerEntry.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.clientEvent.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.agentPeriod.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.commissionPeriod.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("deletes open calculated months that are still rewriteable", async () => {
    prismaMock.commissionPeriod.findMany.mockResolvedValue([
      { id: "aug", periodLabel: "2026-08" },
    ]);

    const labels = await deleteOpenCalculatedPeriods(asOf);

    expect(labels).toEqual(["2026-08"]);
    expect(prismaMock.commissionPeriod.findMany).toHaveBeenCalledWith({
      where: { source: PeriodSource.calculated, status: PeriodStatus.open },
      select: { id: true, periodLabel: true },
    });
    expect(prismaMock.ledgerEntry.deleteMany).toHaveBeenCalledWith({
      where: { periodId: { in: ["aug"] } },
    });
    expect(prismaMock.commissionPeriod.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["aug"] } },
    });
  });

  it("does not delete payday-locked months even if status is still open", async () => {
    prismaMock.commissionPeriod.findMany.mockResolvedValue([
      { id: "jul", periodLabel: "2026-07" },
      { id: "aug", periodLabel: "2026-08" },
    ]);

    const labels = await deleteOpenCalculatedPeriods(asOf);

    expect(labels).toEqual(["2026-08"]);
    expect(prismaMock.commissionPeriod.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["aug"] } },
    });
  });

  it("no-ops when every open month is payday-locked", async () => {
    prismaMock.commissionPeriod.findMany.mockResolvedValue([
      { id: "jul", periodLabel: "2026-07" },
    ]);

    const labels = await deleteOpenCalculatedPeriods(asOf);

    expect(labels).toEqual([]);
    expect(prismaMock.ledgerEntry.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.commissionPeriod.deleteMany).not.toHaveBeenCalled();
  });
});

describe("deletePeriodsByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.commissionAdvance.findMany.mockResolvedValue([]);
  });

  it("skips work when given no ids", async () => {
    await deletePeriodsByIds([]);
    expect(prismaMock.commissionAdvance.findMany).not.toHaveBeenCalled();
  });

  it("detaches advances before wiping money rows", async () => {
    prismaMock.commissionAdvance.findMany.mockResolvedValue([{ id: "adv1" }]);
    prismaMock.commissionAdvance.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.ledgerEntry.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.clientEvent.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.agentPeriod.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.commissionPeriod.deleteMany.mockResolvedValue({ count: 1 });

    await deletePeriodsByIds(["p1"]);

    expect(prismaMock.commissionAdvance.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["adv1"] } },
      data: {
        payAgentPeriodId: null,
        repayAgentPeriodId: null,
        payLedgerEntryId: null,
        repayLedgerEntryId: null,
      },
    });
    expect(prismaMock.ledgerEntry.deleteMany).toHaveBeenCalled();
  });
});
