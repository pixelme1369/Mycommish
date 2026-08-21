import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ClientEventKind,
  FileClaimStatus,
  PeriodSource,
  PeriodStatus,
} from "@/generated/prisma/client";
import {
  CLOSED_PERIOD_ERROR,
  acceptFileClaimReassign,
  commissionOnClientFor,
  countsTowardUnits,
  debtTowardGross,
  sumUnitsAndDebt,
} from "./accept-reassign";

const { prismaMock } = vi.hoisted(() => {
  const fileClaim = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const clientIdentity = {
    findFirst: vi.fn(),
    update: vi.fn(),
  };
  const clientEvent = {
    findMany: vi.fn(),
    update: vi.fn(),
  };
  const agentPeriod = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const ledgerEntry = {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const prismaMock = {
    fileClaim,
    clientIdentity,
    clientEvent,
    agentPeriod,
    ledgerEntry,
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
  );
  return { prismaMock };
});

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

describe("accept-reassign helpers", () => {
  it("counts cleared / safe_cancel / low_credit toward units", () => {
    expect(countsTowardUnits(ClientEventKind.cleared, false)).toBe(true);
    expect(countsTowardUnits(ClientEventKind.safe_cancel, false)).toBe(true);
    expect(countsTowardUnits(ClientEventKind.low_credit_cleared, true)).toBe(true);
    expect(countsTowardUnits(ClientEventKind.pending, false)).toBe(false);
    expect(countsTowardUnits(ClientEventKind.clawback, false)).toBe(false);
  });

  it("excludes low-credit and safe-cancel from gross debt", () => {
    expect(
      debtTowardGross({
        kind: ClientEventKind.cleared,
        isLowCredit: false,
        enrolledDebt: 1000,
      }),
    ).toBe(1000);
    expect(
      debtTowardGross({
        kind: ClientEventKind.cleared,
        isLowCredit: true,
        enrolledDebt: 1000,
      }),
    ).toBe(0);
    expect(
      debtTowardGross({
        kind: ClientEventKind.safe_cancel,
        isLowCredit: false,
        enrolledDebt: 1000,
      }),
    ).toBe(1000);
  });

  it("sums units and debt for a mixed cohort", () => {
    const r = sumUnitsAndDebt([
      { kind: ClientEventKind.cleared, isLowCredit: false, enrolledDebt: 5000 },
      { kind: ClientEventKind.safe_cancel, isLowCredit: false, enrolledDebt: 2000 },
      { kind: ClientEventKind.low_credit_cleared, isLowCredit: true, enrolledDebt: 3000 },
      { kind: ClientEventKind.pending, isLowCredit: false, enrolledDebt: 9000 },
    ]);
    expect(r.unitsCleared).toBe(3);
    expect(r.totalClearedDebt).toBe(7000);
  });

  it("commissionOnClientFor applies tier rate only to paid units", () => {
    expect(
      commissionOnClientFor(
        { kind: ClientEventKind.cleared, isLowCredit: false, enrolledDebt: 10_000 },
        0.02,
      ),
    ).toBe(200);
    expect(
      commissionOnClientFor(
        { kind: ClientEventKind.safe_cancel, isLowCredit: false, enrolledDebt: 10_000 },
        0.02,
      ),
    ).toBe(200);
  });
});

describe("acceptFileClaimReassign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock),
    );
  });

  function baseClaim(overrides?: {
    aliases?: { agentName: string }[];
  }) {
    return {
      id: "claim1",
      crmId: "EXT-1",
      status: FileClaimStatus.pending,
      agentId: "agent1",
      agent: {
        aliases: overrides?.aliases ?? [{ agentName: "Alex Tambouly" }],
      },
    };
  }

  it("refuses when file not in CRM directory", async () => {
    prismaMock.fileClaim.findUnique.mockResolvedValue(baseClaim());
    prismaMock.clientIdentity.findFirst.mockResolvedValue(null);

    const res = await acceptFileClaimReassign({
      claimId: "claim1",
      reviewerId: "admin1",
      adminNote: null,
    });
    expect(res).toEqual({ ok: false, error: "File not in CRM directory." });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("refuses when claimer has no Sales Rep alias", async () => {
    prismaMock.fileClaim.findUnique.mockResolvedValue(baseClaim({ aliases: [] }));
    prismaMock.clientIdentity.findFirst.mockResolvedValue({
      crmId: "CRM-1",
      externalId: "EXT-1",
      salesRep: "Peter Godwin",
    });

    const res = await acceptFileClaimReassign({
      claimId: "claim1",
      reviewerId: "admin1",
      adminNote: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/no Sales Rep alias/);
    }
  });

  it("refuses when commission sits in a closed period", async () => {
    prismaMock.fileClaim.findUnique.mockResolvedValue(baseClaim());
    prismaMock.clientIdentity.findFirst.mockResolvedValue({
      crmId: "CRM-1",
      externalId: "EXT-1",
      salesRep: "Peter Godwin",
    });
    prismaMock.clientEvent.findMany.mockResolvedValue([
      {
        id: "ev1",
        crmId: "CRM-1",
        periodId: "p1",
        agentPeriodId: "ap1",
        agentName: "Peter Godwin",
        kind: ClientEventKind.cleared,
        period: {
          id: "p1",
          status: PeriodStatus.closed,
          periodLabel: "2026-07",
          source: PeriodSource.calculated,
        },
      },
    ]);

    const res = await acceptFileClaimReassign({
      claimId: "claim1",
      reviewerId: "admin1",
      adminNote: null,
    });
    expect(res).toEqual({ ok: false, error: CLOSED_PERIOD_ERROR });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("accepts directory-only file and updates salesRep", async () => {
    prismaMock.fileClaim.findUnique.mockResolvedValue(baseClaim());
    prismaMock.clientIdentity.findFirst.mockResolvedValue({
      crmId: "CRM-1",
      externalId: "EXT-1",
      salesRep: "Peter Godwin",
    });
    prismaMock.clientEvent.findMany.mockResolvedValue([]);
    prismaMock.clientIdentity.update.mockResolvedValue({});
    prismaMock.fileClaim.update.mockResolvedValue({});

    const res = await acceptFileClaimReassign({
      claimId: "claim1",
      reviewerId: "admin1",
      adminNote: "ok",
    });
    expect(res.ok).toBe(true);
    expect(prismaMock.clientIdentity.update).toHaveBeenCalledWith({
      where: { crmId: "CRM-1" },
      data: { salesRep: "Alex Tambouly" },
    });
    expect(prismaMock.fileClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "claim1" },
        data: expect.objectContaining({
          status: FileClaimStatus.accepted,
          assignedSalesRep: "Alex Tambouly",
          reviewedById: "admin1",
        }),
      }),
    );
  });

  it("moves open-period events to claimer and recomputes both agent periods", async () => {
    prismaMock.fileClaim.findUnique.mockResolvedValue(baseClaim());
    prismaMock.clientIdentity.findFirst.mockResolvedValue({
      crmId: "CRM-1",
      externalId: "EXT-1",
      salesRep: "Peter Godwin",
    });
    prismaMock.clientEvent.findMany
      .mockResolvedValueOnce([
        {
          id: "ev1",
          crmId: "CRM-1",
          periodId: "p1",
          agentPeriodId: "ap-peter",
          agentName: "Peter Godwin",
          kind: ClientEventKind.cleared,
          isLowCredit: false,
          enrolledDebt: 10_000,
          commissionOnClient: 175,
          period: {
            id: "p1",
            status: PeriodStatus.open,
            periodLabel: "2026-08",
            source: PeriodSource.calculated,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "ev1",
          crmId: "CRM-1",
          periodId: "p1",
          agentPeriodId: "ap-alex",
          agentName: "Alex Tambouly",
          kind: ClientEventKind.cleared,
          isLowCredit: false,
          enrolledDebt: 10_000,
          commissionOnClient: 175,
        },
      ])
      .mockResolvedValueOnce([]);

    prismaMock.agentPeriod.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "ap-alex",
        periodId: "p1",
        agentName: "Alex Tambouly",
        cancellationRate: 5,
        notes: null,
        grossCommission: 0,
      })
      .mockResolvedValueOnce({
        id: "ap-peter",
        periodId: "p1",
        agentName: "Peter Godwin",
        cancellationRate: 5,
        notes: null,
        grossCommission: 175,
      });

    prismaMock.agentPeriod.findFirst.mockResolvedValue({
      id: "ap-peter",
      periodId: "p1",
      agentName: "Peter Godwin",
      cancellationRate: 5,
    });
    prismaMock.agentPeriod.create.mockResolvedValue({
      id: "ap-alex",
      periodId: "p1",
      agentName: "Alex Tambouly",
      cancellationRate: 5,
    });
    prismaMock.clientEvent.update.mockResolvedValue({});
    prismaMock.ledgerEntry.findMany.mockResolvedValue([]);
    prismaMock.ledgerEntry.create.mockResolvedValue({});
    prismaMock.agentPeriod.update.mockResolvedValue({});
    prismaMock.clientIdentity.update.mockResolvedValue({});
    prismaMock.fileClaim.update.mockResolvedValue({});

    const res = await acceptFileClaimReassign({
      claimId: "claim1",
      reviewerId: "admin1",
      adminNote: null,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.message).toMatch(/Alex Tambouly/);
    }
    expect(prismaMock.clientEvent.update).toHaveBeenCalledWith({
      where: { id: "ev1" },
      data: { agentName: "Alex Tambouly", agentPeriodId: "ap-alex" },
    });
    expect(prismaMock.clientIdentity.update).toHaveBeenCalledWith({
      where: { crmId: "CRM-1" },
      data: { salesRep: "Alex Tambouly" },
    });
    expect(prismaMock.agentPeriod.update).toHaveBeenCalled();
    expect(prismaMock.fileClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: FileClaimStatus.accepted }),
      }),
    );
  });
});
