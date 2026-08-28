export type FollowUpKind = "day3" | "day10";

export type DailyTaskChecklist = {
  emailDone: boolean;
  smsDone: boolean;
  callDone: boolean;
};

export type DailyTaskFile = {
  crmId: string;
  externalId: string | null;
  clientName: string | null;
  phone: string | null;
  enrolledDebt: number | null;
  enrolledDate: string | null;
  enrolledYmd: string;
  firstPaymentDate: string | null;
  firstPaymentClearedDate: string | null;
  payFreq: string | null;
  crmStatus: string | null;
  salesRep: string | null;
  followUp: FollowUpKind;
  checklist: DailyTaskChecklist;
};

export type DailyTaskChannel = "email" | "sms" | "call";
