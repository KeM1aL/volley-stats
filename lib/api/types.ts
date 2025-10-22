export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "is";

export type Filter = {
  field: string;
  operator: FilterOperator;
  value: any;
};

export type Sort<T> = {
  field: keyof T;
  direction: "asc" | "desc";
};