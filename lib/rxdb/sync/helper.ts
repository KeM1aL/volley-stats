import { SupabaseClient } from '@supabase/supabase-js';
import { RxJsonSchema, RxDocumentData, WithDeleted } from 'rxdb';

export const POSTGRES_INSERT_CONFLICT_CODE = "23505";
export const DEFAULT_MODIFIED_FIELD = '_modified';
export const DEFAULT_DELETED_FIELD = '_deleted';


export function addDocEqualityToQuery<RxDocType>(
    jsonSchema: RxJsonSchema<RxDocumentData<RxDocType>>,
    deletedField: string,
    modifiedField: string,
    doc: WithDeleted<RxDocType>,
    query: any
) {
    const ignoreKeys = new Set([
        modifiedField,
        deletedField,
        '_meta',
        '_attachments',
        '_rev',
        'created_at'
    ]);

    for (const key of Object.keys(doc)) {
        if (
            ignoreKeys.has(key)
        ) {
            continue;
        }

        const v = (doc as any)[key];
        const type = typeof v;

        if (type === "string" || type === "number") {
            query = query.eq(key, v);
        } else if (type === "boolean" || v === null) {
            query = query.is(key, v);
        } else if (type === 'undefined') {
            query = query.is(key, null);
        }
        // Objects and arrays (lineups, player lists) can't be compared in a PostgREST filter:
        // they are left out of the equality check, on purpose.
    }

    const schemaProps: Record<string, any> = jsonSchema.properties;
    for (const key of Object.keys(schemaProps)) {
        if (
            ignoreKeys.has(key) ||
            Object.hasOwn(doc, key)
        ) {
            continue;
        }
        query = query.is(key, null);
    }

    query = query.eq(deletedField, doc._deleted);
    if (schemaProps[modifiedField]) {
        query = query.eq(modifiedField, (doc as any)[modifiedField]);
    }


    return query;
}

/**
 * Keeps only the fields the local RxDB schema defines (plus `_deleted`).
 * RxDB rejects documents with unknown fields, so a column added on the server
 * (or a server-only column such as `_modified`) must never reach the local
 * database.
 */
export function pickSchemaFields<T extends Record<string, unknown>>(
  row: T,
  schemaProperties: Record<string, unknown>
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (key === "_deleted" || Object.hasOwn(schemaProperties, key)) out[key] = row[key];
  }
  return out as Partial<T>;
}