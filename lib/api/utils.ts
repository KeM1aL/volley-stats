import { Filter, Sort } from "./types";

export const applySupabaseSorting = <T>(query: any, sort: Sort<T>[]) => {
  for (const sortItem of sort) {
    query = query.order(sortItem.field as string, { ascending: sortItem.direction === 'asc' });
  }
  return query;
};

export const applySupabaseFilters = (query: any, filters: Filter[]) => {
  for (const filter of filters) {
    switch (filter.operator) {
      case "eq":
        query = query.eq(filter.field, filter.value);
        break;
      case "neq":
        query = query.neq(filter.field, filter.value);
        break;
      case "gt":
        query = query.gt(filter.field, filter.value);
        break;
      case "gte":
        query = query.gte(filter.field, filter.value);
        break;
      case "lt":
        query = query.lt(filter.field, filter.value);
        break;
      case "lte":
        query = query.lte(filter.field, filter.value);
        break;
      case "like":
        query = query.like(filter.field, filter.value);
        break;
      case "ilike":
        query = query.ilike(filter.field, filter.value);
        break;
      case "in":
        query = query.in(filter.field, filter.value);
        break;
      case "is":
        query = query.is(filter.field, filter.value);
        break;
      case "or":
        query = query.or(filter.value);
        break;
      case "and":
        query = query.and(filter.value);
        break;
    }
  }
  return query;
};
