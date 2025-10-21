
import { Filter, Sort } from "./types";

export interface DataStore<T> {
  getAll(filter?: Filter<T>, sort?: Sort<T>[]): Promise<T[]>;
  create(item: Partial<T>): Promise<T>;
  update(id: string | number, updates: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<void>;
}
