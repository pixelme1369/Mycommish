export type SendDocumentResult =
  | { ok: true; message: string }
  | { ok: false; error: string };
