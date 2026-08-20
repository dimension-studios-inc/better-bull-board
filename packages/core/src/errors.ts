export class HttpError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = "HttpError"
    this.statusCode = statusCode
  }
}

export class ConcurrencyLimitError extends HttpError {
  constructor(message = "Too many concurrent listJobs requests; try again shortly") {
    super(message, 503)
    this.name = "ConcurrencyLimitError"
  }
}
