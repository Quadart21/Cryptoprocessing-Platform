export class NorenError extends Error {
  /**
   * @param {string} message
   * @param {{ statusCode?: number, code?: string | null, detail?: unknown, body?: string | null }} [extra]
   */
  constructor(message, extra = {}) {
    super(message);
    this.name = "NorenError";
    this.statusCode = extra.statusCode ?? null;
    this.code = extra.code ?? null;
    this.detail = extra.detail ?? null;
    this.body = extra.body ?? null;
  }
}

export class NorenSignatureError extends NorenError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = "NorenSignatureError";
  }
}
