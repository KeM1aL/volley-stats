export type Filter<T> = {
  [P in keyof T]?: T[P] | { $in: T[P][] };
};

export type Sort<T> = {
  field: keyof T;
  direction: 'asc' | 'desc';
};