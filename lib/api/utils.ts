import { Filter, Sort } from "./types";

export const applySupabaseSorting = <T>(query: any, sort: Sort<T>[]) => {
  for (const sortItem of sort) {
    query = query.order(sortItem.field as string, { ascending: sortItem.direction === 'asc' });
  }
  return query;
};

export const applySupabaseFilters = <T>(query: any, filter: Filter<T>) => {
  for (const key in filter) {
    const filterValue = filter[key as keyof T];
    if (typeof filterValue === 'object' && filterValue !== null && '$in' in filterValue) {
      query = query.in(key, filterValue.$in);
    } else {
      query = query.eq(key, filterValue);
    }
  }
  return query;
};