
import { Filter, Sort } from "./types";

export interface DataStore<T> {
  getAll(filters?: Filter[], sort?: Sort<T>[],joins?: string[]): Promise<T[]>;
  create(item: Partial<T>): Promise<T>;
  get(id: string | number): Promise<T>;
  update(id: string | number, updates: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<void>;
}
