import { createClient } from "@/lib/supabase/client";
import { DataStore } from "./datastore";
import { Filter, Sort } from "./types";
import { applySupabaseFilters, applySupabaseSorting } from "./utils";
import { Database } from "../supabase/database.types";

const supabase = createClient();

export class SupabaseDataStore<
  TableName extends keyof Database["public"]["Tables"],
  T = Database["public"]["Tables"][TableName]["Row"]
> implements DataStore<T> {
  constructor(private tableName: TableName) {}

  async getAll(filter?: Filter<T>, sort?: Sort<T>[]): Promise<T[]> {
    let query = supabase.from(this.tableName).select("*");
    if (filter) {
      query = applySupabaseFilters<T>(query, filter);
    }
    if (sort) {
      query = applySupabaseSorting<T>(query, sort);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data as T[]) || [];
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
