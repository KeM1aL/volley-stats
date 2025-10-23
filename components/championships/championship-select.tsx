"use client";

import { Championship } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useChampionshipApi } from "@/hooks/use-championship-api";
import { Filter } from "@/lib/api/types";

type ChampionshipSelectProps = {
  value: Championship | null;
  onChange: (value: Championship | null) => void;
  isClearable?: boolean;
};

const loadOptions = async (
  inputValue: string,
  championshipApi: ReturnType<typeof useChampionshipApi>,
): Promise<Championship[]> => {
  try {
    const filters: Filter[] = [
      {
        field: "name",
        operator: "ilike",
        value: `${inputValue}%`,
      },
    ];

    const championships = await championshipApi.getChampionships(filters);
    return championships;
  } catch (error) {
    console.error("Error fetching championships", error);
    return [];
  }
};

export function ChampionshipSelect({
  value,
  onChange,
  isClearable = false,
}: ChampionshipSelectProps) {
  const championshipApi = useChampionshipApi();

  return (
    <AsyncSelect
      cacheOptions
      loadOptions={(inputValue) => loadOptions(inputValue, championshipApi)}
      defaultOptions
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id.toString()}
      getOptionLabel={(option) => option.name}
      isClearable={isClearable}
      placeholder="Select a Championship ..."
    />
  );
};
