export type OpenerLogActionResult =
  | { ok: true; warning?: string; message?: string }
  | { ok: false; error: string };
