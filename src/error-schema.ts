/**
 * Custom error class for the application
 * This lets us throw errors that carry an intended HTTP status code, instead of manually
 * setting the status code in the response.
 */

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}