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

        if (type === "string") {
            // Special handling for date strings to avoid false positives due to formatting differences
            // (e.g. "2023-01-01T00:00:00.000Z" vs "2023-01-01T00:00:00+00:00")
            // We check if it looks like an ISO date string
            const isIsoDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v as string);
            if (isIsoDate) {
                // For dates, we can't easily normalize in PostgREST query builder without casting.
                // But we can try to be lenient or just rely on string equality if we trust the format.
                // If Supabase returns a different format than what we send, this will loop.
                // Ideally, we should ensure we always store what Supabase sends.
                // But if we just pulled it, it should be identical.
                // Unless `preInsert` modified it?
                // Or if `v` is from local state and it has different precision.

                // Let's just use strict equality for now, but maybe we need to cast in query?
                // query = query.eq(key, v); 
                // Actually, if the local value `v` is "2023...Z" and server has "2023...+00",
                // query.eq(key, "2023...Z") might fail if Postgres compares strings, 
                // or succeed if it compares timestamps. PostgREST usually handles timestamp comparison well.
                // The issue might be if we send a value that Postgres considers "equal" but returns differently.
                // But here we are constructing a query to CHECK if the server has the SAME data.
                // If we send `eq(key, v)` and server has `v_prime` (semantically equal but string-diff),
                // PostgREST `eq` should return true for timestamps.

                query = query.eq(key, v);
            } else {
                query = query.eq(key, v);
            }
        } else if (type === "number") {
            query = query.eq(key, v);
        } else if (type === "boolean" || v === null) {
            query = query.is(key, v);
        } else if (type === 'undefined') {
            query = query.is(key, null);
        } else {
            console.warn(`[addDocEqualityToQuery] ${key} ignored, unknown how to handle type: ${type}`)
        }
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

    // Handle _deleted: false matching NULL on server
    if (doc._deleted === false) {
        // If local is false, server can be false or null (if default is null)
        // PostgREST syntax for OR: or=(col.is.null,col.is.false)
        // But we are chaining.
        // query.or(`"${deletedField}".is.null,"${deletedField}".is.false`)
        // We need to be careful not to break the chain of ANDs.
        // PostgREST `.or()` adds an OR condition. If used with other filters, it might be AND (OR).
        // But `query` here is a PostgREST FilterBuilder.
        // .eq().or() -> ... AND (... OR ...)
        query = query.or(`"${deletedField}".is.null,"${deletedField}".is.false`);
    } else {
        query = query.eq(deletedField, doc._deleted);
    }

    if (schemaProps[modifiedField]) {
        query = query.eq(modifiedField, (doc as any)[modifiedField]);
    }

    console.debug('addDocEqualityToQuery', query);
    return query;
}