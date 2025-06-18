export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  readonly statusCode = 400;
  readonly errorCode = 'VALIDATION_ERROR';
  readonly isOperational = true;
}

export class AuthenticationError extends BaseError {
  readonly statusCode = 401;
  readonly errorCode = 'AUTHENTICATION_ERROR';
  readonly isOperational = true;
}

export class AuthorizationError extends BaseError {
  readonly statusCode = 403;
  readonly errorCode = 'AUTHORIZATION_ERROR';
  readonly isOperational = true;
}

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly errorCode = 'NOT_FOUND_ERROR';
  readonly isOperational = true;
}

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly errorCode = 'CONFLICT_ERROR';
  readonly isOperational = true;
}

export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly errorCode = 'INTERNAL_SERVER_ERROR';
  readonly isOperational = false;
}

export class ServiceUnavailableError extends BaseError {
  readonly statusCode = 503;
  readonly errorCode = 'SERVICE_UNAVAILABLE_ERROR';
  readonly isOperational = true;
} 