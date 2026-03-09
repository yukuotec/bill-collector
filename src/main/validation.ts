/**
 * Input validation utilities for IPC handlers
 */

import { SourceId, SOURCES } from '../shared/sources';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate a file path to prevent path traversal
 */
export function validateFilePath(filePath: string, allowedDirs?: string[]): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('File path is required');
  }

  // Normalize path
  const normalized = filePath.replace(/\\/g, '/');

  // Check for path traversal attempts
  if (normalized.includes('../') || normalized.includes('..\\')) {
    throw new ValidationError('Path traversal detected');
  }

  // Check for null bytes
  if (normalized.includes('\0')) {
    throw new ValidationError('Invalid path: null byte detected');
  }

  // If allowed directories specified, verify path is within them
  if (allowedDirs && allowedDirs.length > 0) {
    const isAllowed = allowedDirs.some(dir => normalized.startsWith(dir.replace(/\\/g, '/')));
    if (!isAllowed) {
      throw new ValidationError('File path not in allowed directory');
    }
  }

  return normalized;
}

/**
 * Validate import source
 */
export function validateSource(source: string): SourceId {
  const validSources = SOURCES.map(s => s.id);
  if (!validSources.includes(source as SourceId)) {
    throw new ValidationError(`Invalid source: ${source}. Must be one of: ${validSources.join(', ')}`);
  }
  return source as SourceId;
}

/**
 * Validate UUID/id string
 */
export function validateId(id: string, fieldName = 'id'): string {
  if (!id || typeof id !== 'string') {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (id.length < 1 || id.length > 256) {
    throw new ValidationError(`${fieldName} must be between 1 and 256 characters`);
  }

  // Only allow alphanumeric, hyphen, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ValidationError(`${fieldName} contains invalid characters`);
  }

  return id;
}

/**
 * Validate string length and content
 */
export function validateString(value: string, fieldName: string, maxLength = 1000): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} exceeds maximum length of ${maxLength}`);
  }

  // Sanitize HTML/script tags to prevent XSS
  return sanitizeHtml(value);
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(text: string): string {
  if (!text) return text;

  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;');
}

/**
 * Validate amount (number)
 */
export function validateAmount(amount: number): number {
  if (typeof amount !== 'number') {
    throw new ValidationError('Amount must be a number');
  }

  if (!isFinite(amount)) {
    throw new ValidationError('Amount must be finite');
  }

  // Reasonable limits (in CNY, so max 1 billion)
  if (Math.abs(amount) > 1000000000) {
    throw new ValidationError('Amount exceeds reasonable limits');
  }

  return amount;
}

/**
 * Validate date string (ISO format)
 */
export function validateDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new ValidationError('Date is required');
  }

  // Check ISO date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new ValidationError('Date must be in YYYY-MM-DD format');
  }

  // Check it's a valid date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date');
  }

  return dateStr;
}

/**
 * Validate year
 */
export function validateYear(year: number): number {
  if (typeof year !== 'number') {
    throw new ValidationError('Year must be a number');
  }

  const currentYear = new Date().getFullYear();
  if (year < 2000 || year > currentYear + 1) {
    throw new ValidationError(`Year must be between 2000 and ${currentYear + 1}`);
  }

  return year;
}

/**
 * Validate array of IDs
 */
export function validateIdArray(ids: string[], fieldName = 'ids'): string[] {
  if (!Array.isArray(ids)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (ids.length === 0) {
    return [];
  }

  if (ids.length > 10000) {
    throw new ValidationError(`${fieldName} exceeds maximum of 10000 items`);
  }

  return ids.map((id, index) => validateId(id, `${fieldName}[${index}]`));
}

/**
 * Validate category name
 */
export function validateCategory(category: string): string {
  const validCategories = ['餐饮', '交通', '购物', '住房', '医疗', '娱乐', '通讯', '其他'];

  if (!category || typeof category !== 'string') {
    throw new ValidationError('Category is required');
  }

  if (!validCategories.includes(category)) {
    throw new ValidationError(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
  }

  return category;
}

/**
 * Wrap an IPC handler with validation
 */
export function withValidation<T extends (...args: any[]) => any>(
  handlerName: string,
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ValidationError) {
        console.error(`[IPC Validation Error] ${handlerName}:`, error.message);
        throw error;
      }
      throw error;
    }
  }) as T;
}
