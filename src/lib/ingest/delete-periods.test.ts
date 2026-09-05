import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeriodSource, PeriodStatus } from "@/generated/prisma/client";
import {
  clearOpenCalculatedPeriods,
  deletePeriodsByIds,
} from "./delete-periods";

const { prismaMock } = vi.hoisted(() => {
  return {
    prismaMock: {
      commissionPeriod: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
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

function mockOpenAndHistory(
  open: Array<{ id: string; periodLabel: string }>,
  historyLabels: string[] = [],
) {
  prismaMock.commissionPeriod.findMany.mockImplementation(
    async (args: { where?: { source?: PeriodSource } }) => {
      if (args.where?.source === PeriodSource.history) {
        return historyLabels.map((periodLabel) => ({ periodLabel }));
      }
      return open;
    },
  );
}

describe("clearOpenCalculatedPeriods", () => {
  const asOf = new Date("2026-09-05T12:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.commissionAdvance.findMany.mockResolvedValue([]);
    prismaMock.commissionAdvance.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.ledgerEntry.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.clientEvent.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.agentPeriod.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.commissionPeriod.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.commissionPeriod.updateMany.mockResolvedValue({ count: 0 });
  });

  it("clears money rows but keeps the open period id", async () => {
    mockOpenAndHistory([{ id: "aug", periodLabel: "2026-08" }]);

    const cleared = await clearOpenCalculatedPeriods(asOf);

    expect(cleared).toEqual([{ id: "aug", periodLabel: "2026-08" }]);
    expect(prismaMock.ledgerEntry.deleteMany).toHaveBeenCalledWith({
      where: { periodId: { in: ["aug"] } },
    });
    expect(prismaMock.agentPeriod.deleteMany).toHaveBeenCalledWith({
      where: { periodId: { in: ["aug"] } },
    });
    expect(prismaMock.commissionPeriod.deleteMany).not.toHaveBeenCalled();
  });

  it("closes payday-locked months instead of rebuilding them", async () => {
    mockOpenAndHistory([
      { id: "jul", periodLabel: "2026-07" },
      { id: "aug", periodLabel: "2026-08" },
    ]);

    const cleared = await clearOpenCalculatedPeriods(asOf);

    expect(cleared).toEqual([{ id: "aug", periodLabel: "2026-08" }]);
    expect(prismaMock.commissionPeriod.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["jul"] } },
      data: { status: PeriodStatus.closed, closedAt: asOf },
    });
    expect(prismaMock.ledgerEntry.deleteMany).toHaveBeenCalledWith({
      where: { periodId: { in: ["aug"] } },
    });
  });

  it("does not rebuild a month that was logged as paid (History)", async () => {
    mockOpenAndHistory([{ id: "aug", periodLabel: "2026-08" }], ["2026-08"]);

    const cleared = await clearOpenCalculatedPeriods(asOf);

    expect(cleared).toEqual([]);
    expect(prismaMock.commissionPeriod.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["aug"] } },
      data: { status: PeriodStatus.closed, closedAt: asOf },
    });
    expect(prismaMock.ledgerEntry.deleteMany).not.toHaveBeenCalled();
  });

  it("no-ops when every open month is payday-locked", async () => {
    mockOpenAndHistory([{ id: "jul", periodLabel: "2026-07" }]);

    const cleared = await clearOpenCalculatedPeriods(asOf);

    expect(cleared).toEqual([]);
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

  it("detaches advances before wiping money rows and the period", async () => {
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
    expect(prismaMock.commissionPeriod.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1"] } },
    });
  });
});
