import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClientEventKind,
  PeriodSource,
  PeriodStatus,
} from "@/generated/prisma/client";
import {
  isPromoteClawbackRow,
  isPromotePaidRow,
  promoteCalculatedPeriodToHistory,
} from "./promote-to-history";
import { listDismissedKeys } from "@/lib/agents/dismissal";
import { listExcludedKeysForPeriod } from "@/lib/agents/period-exclusion";

const { prismaMock } = vi.hoisted(() => {
  const commissionPeriod = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  const agentPeriod = {
    findMany: vi.fn(),
    create: vi.fn(),
  };
  const clientEvent = {
    findMany: vi.fn(),
    createMany: vi.fn(),
  };
  const ledgerEntry = {
    createMany: vi.fn(),
  };
  const clientIdentity = {
    createMany: vi.fn(),
  };
  const uploadBatch = {
    create: vi.fn(),
    update: vi.fn(),
  };
  return {
    prismaMock: {
      commissionPeriod,
      agentPeriod,
      clientEvent,
      ledgerEntry,
      clientIdentity,
      uploadBatch,
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

vi.mock("@/lib/agents/dismissal", () => ({
  listDismissedKeys: vi.fn(async () => new Set<string>()),
}));

vi.mock("@/lib/agents/period-exclusion", () => ({
  listExcludedKeysForPeriod: vi.fn(async () => new Set<string>()),
}));

describe("promote row helpers", () => {
  it("treats cleared / safe_cancel / low_credit as paid", () => {
    expect(isPromotePaidRow(ClientEventKind.cleared, false)).toBe(true);
    expect(isPromotePaidRow(ClientEventKind.safe_cancel, false)).toBe(true);
    expect(isPromotePaidRow(ClientEventKind.low_credit_cleared, true)).toBe(true);
    expect(isPromotePaidRow(ClientEventKind.pending, false)).toBe(false);
  });

  it("treats clawback kinds as subtract rows", () => {
    expect(isPromoteClawbackRow(ClientEventKind.clawback, true)).toBe(true);
    expect(isPromoteClawbackRow(ClientEventKind.cordoba_clawback, false)).toBe(true);
    expect(isPromoteClawbackRow(ClientEventKind.cleared, false)).toBe(false);
  });
});

describe("promoteCalculatedPeriodToHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listDismissedKeys).mockResolvedValue(new Set());
    vi.mocked(listExcludedKeysForPeriod).mockResolvedValue(new Set());
  });

  it("refuses when calculated period missing", async () => {
    prismaMock.commissionPeriod.findFirst.mockResolvedValueOnce(null);
    const res = await promoteCalculatedPeriodToHistory("missing");
    expect(res).toEqual({ ok: false, error: "Calculated period not found." });
  });

  it("refuses when history month already exists", async () => {
    prismaMock.commissionPeriod.findFirst
      .mockResolvedValueOnce({
        id: "calc1",
        periodLabel: "2026-07",
        source: PeriodSource.calculated,
      })
      .mockResolvedValueOnce({
        id: "hist1",
        periodLabel: "2026-07",
        source: PeriodSource.history,
        filename: "old.xlsx",
      });

    const res = await promoteCalculatedPeriodToHistory("calc1");
    expect(res).toEqual({
      ok: false,
      error: "History for 2026-07 already exists — delete it to re-log.",
    });
  });

  it("skips dismissed agents so only active payees are logged", async () => {
    prismaMock.commissionPeriod.findFirst
      .mockResolvedValueOnce({
        id: "calc1",
        periodLabel: "2026-07",
        source: PeriodSource.calculated,
      })
      .mockResolvedValueOnce(null);

    vi.mocked(listDismissedKeys).mockResolvedValue(new Set(["brian smith"]));

    prismaMock.agentPeriod.findMany.mockResolvedValue([
      {
        id: "ap-active",
        agentName: "Alex",
        tierRate: 0.02,
        cancellationRate: 0,
        rawTier: 1,
        adjustedTier: 1,
        payoutType: "commission",
        qualityBonusEligible: true,
        cancellationPenaltyApplied: false,
        nsfFlagged: false,
      },
      {
        id: "ap-dismissed",
        agentName: "Brian Smith",
        tierRate: 0.01,
        cancellationRate: 0,
        rawTier: 1,
        adjustedTier: 1,
        payoutType: "commission",
        qualityBonusEligible: true,
        cancellationPenaltyApplied: false,
        nsfFlagged: false,
      },
    ]);

    prismaMock.clientEvent.findMany.mockImplementation(async (args: {
      where: { agentPeriodId: { in: string[] } };
    }) => {
      const ids = new Set(args.where.agentPeriodId.in);
      expect(ids.has("ap-active")).toBe(true);
      expect(ids.has("ap-dismissed")).toBe(false);
      return [
        {
          id: "e1",
          agentPeriodId: "ap-active",
          crmId: "111",
          agentName: "Alex",
          kind: ClientEventKind.cleared,
          isCleared: true,
          clawbackApplied: false,
          clientName: "Client A",
          paymentsMade: 1,
          enrolledDebt: 10_000,
          creditScore: 650,
          isLowCredit: false,
          commissionOnClient: 200,
          paidRate: null,
          payFreq: null,
          enrolledDate: null,
          firstPaymentClearedDate: null,
          droppedDate: null,
        },
      ];
    });

    prismaMock.uploadBatch.create.mockResolvedValue({ id: "batch1" });
    prismaMock.commissionPeriod.create.mockResolvedValue({
      id: "hist-new",
      periodLabel: "2026-07",
      source: PeriodSource.history,
      status: PeriodStatus.closed,
    });
    prismaMock.agentPeriod.create.mockResolvedValue({ id: "hap1" });
    prismaMock.clientIdentity.createMany.mockResolvedValue({ count: 1 });
    prismaMock.clientEvent.createMany.mockResolvedValue({ count: 1 });
    prismaMock.ledgerEntry.createMany.mockResolvedValue({ count: 1 });
    prismaMock.uploadBatch.update.mockResolvedValue({});

    const res = await promoteCalculatedPeriodToHistory("calc1");
    expect(res).toMatchObject({
      ok: true,
      agentCount: 1,
      paidFileCount: 1,
    });
    expect(prismaMock.agentPeriod.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.agentPeriod.create.mock.calls[0][0].data.agentName).toBe(
      "Alex",
    );
  });

  it("copies exact commissionOnClient, paidRate, and clawback amounts", async () => {
    prismaMock.commissionPeriod.findFirst
      .mockResolvedValueOnce({
        id: "calc1",
        periodLabel: "2026-07",
        source: PeriodSource.calculated,
      })
      .mockResolvedValueOnce(null);

    prismaMock.agentPeriod.findMany.mockResolvedValue([
      {
        id: "ap1",
        agentName: "Alex",
        tierRate: 0.02,
        cancellationRate: 10,
        rawTier: 1,
        adjustedTier: 1,
        payoutType: "commission",
        qualityBonusEligible: true,
        cancellationPenaltyApplied: false,
        nsfFlagged: false,
      },
    ]);

    prismaMock.clientEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        agentPeriodId: "ap1",
        crmId: "111",
        agentName: "Alex",
        kind: ClientEventKind.cleared,
        isCleared: true,
        clawbackApplied: false,
        clientName: "Client A",
        paymentsMade: 2,
        enrolledDebt: 10_000,
        creditScore: 650,
        isLowCredit: false,
        commissionOnClient: 200,
        paidRate: null,
        payFreq: "Bi-Weekly",
        enrolledDate: "2026-06-01",
        firstPaymentClearedDate: "2026-07-01",
        droppedDate: null,
      },
      {
        id: "e2",
        agentPeriodId: "ap1",
        crmId: "222",
        agentName: "Alex",
        kind: ClientEventKind.cleared,
        isCleared: true,
        clawbackApplied: false,
        clientName: "Client B",
        paymentsMade: 1,
        enrolledDebt: 5_000,
        creditScore: 700,
        isLowCredit: false,
        commissionOnClient: 100,
        paidRate: null,
        payFreq: "Monthly",
        enrolledDate: "2026-06-15",
        firstPaymentClearedDate: "2026-07-10",
        droppedDate: null,
      },
      {
        id: "e3",
        agentPeriodId: "ap1",
        crmId: "333",
        agentName: "Alex",
        kind: ClientEventKind.clawback,
        isCleared: false,
        clawbackApplied: true,
        clientName: "Client C",
        paymentsMade: 0,
        enrolledDebt: 8_000,
        creditScore: null,
        isLowCredit: false,
        commissionOnClient: 0,
        clawbackAmount: 160,
        paidRate: null,
        payFreq: null,
        enrolledDate: null,
        firstPaymentClearedDate: null,
        droppedDate: "2026-07-20",
      },
    ]);

    prismaMock.uploadBatch.create.mockResolvedValue({ id: "batch1" });
    prismaMock.commissionPeriod.create.mockResolvedValue({
      id: "hist-new",
      periodLabel: "2026-07",
      source: PeriodSource.history,
      status: PeriodStatus.closed,
    });
    prismaMock.agentPeriod.create.mockResolvedValue({ id: "hap1" });
    prismaMock.clientIdentity.createMany.mockResolvedValue({ count: 3 });
    prismaMock.clientEvent.createMany.mockResolvedValue({ count: 3 });
    prismaMock.ledgerEntry.createMany.mockResolvedValue({ count: 2 });
    prismaMock.uploadBatch.update.mockResolvedValue({});

    const res = await promoteCalculatedPeriodToHistory("calc1");
    expect(res).toMatchObject({
      ok: true,
      historyPeriodId: "hist-new",
      periodLabel: "2026-07",
      paidFileCount: 2,
      clawbackFileCount: 1,
      agentCount: 1,
    });

    expect(prismaMock.agentPeriod.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        agentName: "Alex",
        unitsCleared: 2,
        totalClearedDebt: expect.anything(),
        grossCommission: expect.anything(),
        clawbackAmount: expect.anything(),
        netCommission: expect.anything(),
        tierRate: expect.anything(),
      }),
    });
    const apData = prismaMock.agentPeriod.create.mock.calls[0][0].data;
    expect(Number(apData.grossCommission)).toBe(300);
    expect(Number(apData.clawbackAmount)).toBe(160);
    expect(Number(apData.netCommission)).toBe(140);
    expect(Number(apData.totalClearedDebt)).toBe(15_000);
    expect(Number(apData.tierRate)).toBe(0.02);

    const eventPayload = prismaMock.clientEvent.createMany.mock.calls[0][0].data;
    const paidA = eventPayload.find((e: { crmId: string }) => e.crmId === "111");
    const paidB = eventPayload.find((e: { crmId: string }) => e.crmId === "222");
    const claw = eventPayload.find((e: { crmId: string }) => e.crmId === "333");
    expect(paidA).toMatchObject({
      kind: ClientEventKind.history_paid,
      commissionOnClient: expect.anything(),
      isCleared: true,
    });
    expect(Number(paidA.commissionOnClient)).toBe(200);
    expect(Number(paidA.paidRate)).toBe(0.02);
    expect(Number(paidB.commissionOnClient)).toBe(100);
    expect(claw).toMatchObject({
      kind: ClientEventKind.history_subtract,
      clawbackApplied: true,
    });
    expect(Number(claw.clawbackAmount)).toBe(160);

    const ledgerPayload = prismaMock.ledgerEntry.createMany.mock.calls[0][0].data;
    expect(ledgerPayload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: "history_period_gross",
        }),
        expect.objectContaining({
          reasonCode: "history_to_subtract",
          crmId: "333",
        }),
      ]),
    );
    expect(Number(ledgerPayload.find((l: { reasonCode: string }) => l.reasonCode === "history_period_gross").amount)).toBe(300);
    expect(Number(ledgerPayload.find((l: { reasonCode: string }) => l.reasonCode === "history_to_subtract").amount)).toBe(160);
  });
});
