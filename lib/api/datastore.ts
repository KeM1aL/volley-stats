
import { Filter, Sort } from "./types";

export interface DataStore<T> {
  getAll(filters?: Filter[], sort?: Sort<T>[],joins?: string[]): Promise<T[]>;
  create(item: Partial<T>): Promise<T>;
  get(id: string, joins?: string[]): Promise<T | null>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}
