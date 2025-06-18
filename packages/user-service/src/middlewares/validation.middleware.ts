import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from '../exceptions';

/**
 * Enhanced Validation Middleware using Zod
 * Follows comprehensive rules: SoC, single responsibility
 * Only handles schema validation, no business logic
 */

// Request validation locations
export enum ValidateLocation {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
  HEADERS = 'headers'
}

// Validation configuration interface
interface ValidationConfig {
  location: ValidateLocation;
  schema: ZodSchema<any>;
  stripUnknown?: boolean;
  allowPartial?: boolean;
}

/**
 * Universal Zod validation middleware
 * Single responsibility: validate request data against Zod schemas
 */
export const validateRequest = (config: ValidationConfig | ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Handle both simple schema and full config
      const validationConfig: ValidationConfig = config instanceof z.ZodType 
        ? { location: ValidateLocation.BODY, schema: config }
        : config;

      const { location, schema, stripUnknown = true, allowPartial = false } = validationConfig;

      // Get data to validate based on location
      const dataToValidate = req[location];

      // Apply partial validation if requested  
      const validationSchema = allowPartial && 'partial' in schema ? (schema as any).partial() : schema;

      // Parse and validate data
      const validationResult = validationSchema.safeParse(dataToValidate);

      if (!validationResult.success) {
        const zodError = validationResult.error as ZodError;
        
        // Format Zod errors to our standard format
        const formattedErrors = zodError.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          value: err.path.reduce((obj, key) => obj?.[key], dataToValidate)
        }));

        const errorMessage = formattedErrors
          .map(err => `${err.field}: ${err.message}`)
          .join(', ');
        
        throw new ValidationError(
          errorMessage,
          'VALIDATION_4000_SCHEMA_VALIDATION_FAILED',
          'request',
          formattedErrors
        );
      }

      // Apply validated data back to request (with unknown fields stripped if configured)
      if (stripUnknown) {
        req[location] = validationResult.data;
      }

      next();
    } catch (error) {
      // Pass any validation errors to error handler
      next(error);
    }
  };
};

/**
 * Validate request body against Zod schema
 */
export const validateBody = (schema: ZodSchema<any>, options?: { stripUnknown?: boolean; allowPartial?: boolean }) => {
  return validateRequest({
    location: ValidateLocation.BODY,
    schema,
    stripUnknown: options?.stripUnknown ?? true,
    allowPartial: options?.allowPartial ?? false
  });
};

/**
 * Validate query parameters against Zod schema
 */
export const validateQuery = (schema: ZodSchema<any>, options?: { stripUnknown?: boolean; allowPartial?: boolean }) => {
  return validateRequest({
    location: ValidateLocation.QUERY,
    schema,
    stripUnknown: options?.stripUnknown ?? true,
    allowPartial: options?.allowPartial ?? false
  });
};

/**
 * Validate URL parameters against Zod schema
 */
export const validateParams = (schema: ZodSchema<any>, options?: { stripUnknown?: boolean; allowPartial?: boolean }) => {
  return validateRequest({
    location: ValidateLocation.PARAMS,
    schema,
    stripUnknown: options?.stripUnknown ?? true,
    allowPartial: options?.allowPartial ?? false
  });
};

/**
 * Validate headers against Zod schema
 */
export const validateHeaders = (schema: ZodSchema<any>, options?: { stripUnknown?: boolean; allowPartial?: boolean }) => {
  return validateRequest({
    location: ValidateLocation.HEADERS,
    schema,
    stripUnknown: options?.stripUnknown ?? true,
    allowPartial: options?.allowPartial ?? false
  });
};

/**
 * Validate multiple locations in a single middleware
 */
export const validateMultiple = (configs: ValidationConfig[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const allErrors: any[] = [];

      // Validate each configuration
      for (const config of configs) {
        const { location, schema, allowPartial = false } = config;
        const dataToValidate = req[location];
                 const validationSchema = allowPartial && 'partial' in schema ? (schema as any).partial() : schema;
        const result = validationSchema.safeParse(dataToValidate);

        if (!result.success) {
                   const formattedErrors = result.error.errors.map((err: any) => ({
           location,
           field: err.path.join('.'),
           message: err.message,
           code: err.code,
           value: err.path.reduce((obj: any, key: any) => obj?.[key], dataToValidate)
          }));
          
          allErrors.push(...formattedErrors);
        } else if (config.stripUnknown) {
          // Apply validated data back
          req[location] = result.data;
        }
      }

      if (allErrors.length > 0) {
        const errorMessage = allErrors
          .map(err => `${err.location}.${err.field}: ${err.message}`)
          .join(', ');
        
        throw new ValidationError(
          errorMessage,
          'VALIDATION_4000_MULTI_LOCATION_VALIDATION_FAILED',
          'request',
          allErrors
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional validation - continues even if validation fails but logs issues
 * Useful for backwards compatibility or gradual migration
 */
export const validateOptional = (config: ValidationConfig | ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validationConfig: ValidationConfig = config instanceof z.ZodType 
        ? { location: ValidateLocation.BODY, schema: config }
        : config;

      const { location, schema } = validationConfig;
      const dataToValidate = req[location];
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        // Log validation issues but continue
        console.warn(`Optional validation failed for ${location}:`, result.error.errors);
        
        // Optionally add validation warnings to request context
        (req as any).validationWarnings = result.error.errors;
      } else if (validationConfig.stripUnknown) {
        req[location] = result.data;
      }

      next();
    } catch (error) {
      // For optional validation, log error but continue
      console.warn('Optional validation error:', error);
      next();
    }
  };
};

/**
 * Transform validation errors for consistent API responses
 * This is a utility function, main error handling is in error.middleware.ts
 */
export const transformValidationError = (zodError: ZodError): any[] => {
  return zodError.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    receivedValue: err.path.length > 0 ? 'hidden' : undefined // Don't expose values in prod
  }));
};

/**
 * Create a validation middleware that applies both schema validation and custom business rules
 * Schema validation happens first, then custom rules
 */
export const validateWithCustomRules = (
  schema: ZodSchema<any>,
  customValidator: (data: any, req: Request) => Promise<void> | void
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // First apply schema validation
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const formattedErrors = transformValidationError(result.error);
        const errorMessage = formattedErrors
          .map(err => `${err.field}: ${err.message}`)
          .join(', ');
        
        throw new ValidationError(
          errorMessage,
          'VALIDATION_4000_SCHEMA_VALIDATION_FAILED',
          'request',
          formattedErrors
        );
      }

      // Apply validated data
      req.body = result.data;

      // Then apply custom business rules
      await customValidator(result.data, req);

      next();
    } catch (error) {
      next(error);
    }
  };
}; 