export type OpenerLogActionResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string };
