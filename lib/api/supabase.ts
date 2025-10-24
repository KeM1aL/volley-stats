import { supabase } from "@/lib/supabase/client";
import { DataStore } from "./datastore";
import { Filter, Sort } from "./types";
import { applySupabaseFilters, applySupabaseSorting } from "./utils";
import { Database } from "../supabase/database.types";

export class SupabaseDataStore<
  TableName extends keyof Database["public"]["Tables"],
  T = Database["public"]["Tables"][TableName]["Row"]
> implements DataStore<T> {
  constructor(private tableName: TableName) {}

  async getAll(filters?: Filter[], sort?: Sort<T>[], joins?: string[]): Promise<T[]> {
    let select = "*";
    

    if (joins && joins.length > 0) {
      joins.forEach((join) => {
        if (!select.includes(`${join}(`)) {
          select += `,${join}(*)`;
        }
      });
    }

    if (filters) {
      filters.forEach((f) => {
        if (f.field && f.field.includes(".")) {
          const tableName = f.field.split(".")[0];

          if (select.includes(`${tableName}(*)`)) {
            select = select.replace(`${tableName}(*)`, `${tableName}!inner(*)`);
          } else if(!select.includes(`${tableName}!inner(*)`)) {
            select += `,${tableName}!inner(*)`;
          }
        }
      });
    }

    let query = supabase.from(this.tableName).select(select);
    if (filters && filters.length > 0) {
      query = applySupabaseFilters(query, filters);
    }
    if (sort) {
      query = applySupabaseSorting<T>(query, sort);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data as T[]) || [];
  }

  async get(id: string | number): Promise<T> {
    let query = supabase.from(this.tableName).select('*').eq('id', id as any);
    const { data, error } = await query;
      if (error) throw error;
      return (data as T);
  }

  async create(item: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(this.tableName)
      // @ts-ignore
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }

  async update(id: string | number, updates: Partial<T>): Promise<T> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates as any)
      .eq("id", id as any)
      .select()
      .single();
    if (error) throw error;
    return data as T;
  }

  async delete(id: string | number): Promise<void> {
    const { error } = await supabase.from(this.tableName).delete().eq("id", id as any);
    if (error) throw error;
  }
}
