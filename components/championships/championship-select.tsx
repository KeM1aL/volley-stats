"use client";

import { supabase } from "@/lib/supabase/client";
import { Championship } from "@/lib/types";
import AsyncSelect from "react-select/async";

type ChampionshipSelectProps = {
  value: Championship | null;
  onChange: (value: Championship | null) => void;
  isClearable?: boolean;
};

const loadOptions = async (inputValue: string): Promise<Championship[]> => {
  const { data, error } = await supabase
    .from("championships")
    .select("*")
    .ilike("name", `%${inputValue}%`)
    .limit(10);

  if (error) {
    console.error("Error fetching championships", error);
    return [];
  }
  return data as Championship[];
};

export function ChampionshipSelect({
  value,
  onChange,
  isClearable = false,
}: ChampionshipSelectProps) {
  return (
    <AsyncSelect
      cacheOptions
      loadOptions={loadOptions}
      defaultOptions
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id.toString()}
      getOptionLabel={(option) => option.name}
      isClearable={isClearable}
    />
  );
};