import { z } from 'zod';
import { notFound, unprocessable } from './errors';

export const DATASETS = [
  'owners', 'pets', 'paravets', 'respondents', 'households',
  'animals', 'stubs', 'services', 'programs', 'participants',
] as const;

export type Dataset = (typeof DATASETS)[number];
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === 'object') return Object.values(value).every(isJsonValue);
  return false;
}

export function jsonValue(value: unknown): JsonValue {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw unprocessable('INVALID_RECORD_DATA', 'Record data must be valid JSON.');
  const decoded: unknown = JSON.parse(encoded);
  if (!isJsonValue(decoded)) throw unprocessable('INVALID_RECORD_DATA', 'Record data must be valid JSON.');
  return decoded;
}

export function normalizeRecordInputs(record: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...record };
  for (const [field, value] of Object.entries(normalized)) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (/^(mobile|contact|phone|telephone)$/i.test(field)) {
      const digits = value.replace(/\D/g, '');
      if (!/^09\d{9}$/.test(digits)) {
        const label = field.toLowerCase() === 'contact' ? 'Contact number' : 'Mobile number';
        throw unprocessable('INVALID_MOBILE', `${label} is incorrect. Use a Philippine mobile number like 0917-123-4567.`, { field, expected: '0917-123-4567' });
      }
      normalized[field] = `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
      continue;
    }
    if (/date/i.test(field) && !/^(createdAt|updatedAt|created_at|updated_at)$/i.test(field)) {
      const datePart = value.match(/^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/)?.[1];
      const date = datePart ? new Date(`${datePart}T00:00:00.000Z`) : null;
      if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== datePart || (value.includes('T') && Number.isNaN(Date.parse(value)))) {
        throw unprocessable('INVALID_DATE', `${field.replaceAll('_', ' ')} must be a real date in YYYY-MM-DD format.`, { field, expected: 'YYYY-MM-DD' });
      }
    }
  }
  return normalized;
}

export function dataset(value: string): Dataset {
  if ((DATASETS as readonly string[]).includes(value)) return value as Dataset;
  throw notFound('Dashboard dataset not found.');
}

export const record = z.record(z.string(), z.unknown()).superRefine((value, ctx) => {
  if (typeof value.id !== 'string' && typeof value.id !== 'number') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Each record needs a string or numeric id.', path: ['id'] });
  } else if (typeof value.id === 'string' && (!value.id.trim() || value.id.length > 100)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Record ids must contain 1 to 100 non-blank characters.', path: ['id'] });
  } else if (typeof value.id === 'number' && (!Number.isInteger(value.id) || value.id < 1)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Numeric record ids must be positive integers.', path: ['id'] });
  }
});

export const recordBatch = z.object({ records: z.array(record).min(1).max(100) });
export const archiveBatch = z.object({
  ids: z.array(z.union([z.string().min(1).max(100), z.number().int().positive()])).min(1).max(500),
  archived: z.boolean(),
});
