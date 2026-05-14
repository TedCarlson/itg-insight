export class DispatchApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function dispatchBadRequest(code: string, details?: unknown): never {
  throw new DispatchApiError(400, code, details);
}

export function dispatchForbidden(code = "forbidden", details?: unknown): never {
  throw new DispatchApiError(403, code, details);
}

export function dispatchNotFound(code: string, details?: unknown): never {
  throw new DispatchApiError(404, code, details);
}