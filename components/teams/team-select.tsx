"use client";

import { Team } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useTeamApi } from "@/hooks/use-team-api";
import { Filter } from "@/lib/api/types";

type TeamSelectProps = {
  value: Team | null;
  onChange: (value: Team | null) => void;
  isClearable?: boolean;
  clubId?: string | null;
  championshipId?: number | null;
};

const loadOptions = async (
  inputValue: string,
  teamApi: ReturnType<typeof useTeamApi>,
  clubId?: string | null,
  championshipId?: number | null
): Promise<Team[]> => {
  try {
    const filters: Filter[] = [
      {
        field: "name",
        operator: "ilike",
        value: `${inputValue}%`,
      },
    ];

    if (clubId) {
      filters.push({
        field: "club_id",
        operator: "eq",
        value: clubId,
      });
    }

    if (championshipId) {
      filters.push({
        field: "championship_id",
        operator: "eq",
        value: championshipId,
      });
    }

    const teams = await teamApi.getTeams(filters);
    return teams;
  } catch (error) {
    console.error("Error fetching teams", error);
    return [];
  }
};

export function TeamSelect({
  value,
  onChange,
  isClearable = false,
  clubId,
  championshipId,
}: TeamSelectProps) {
  const teamApi = useTeamApi();

  return (
    <AsyncSelect
      key={`${clubId}-${championshipId}`}
      cacheOptions
      loadOptions={(inputValue) =>
        loadOptions(inputValue, teamApi, clubId, championshipId)
      }
      defaultOptions
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id.toString()}
      getOptionLabel={(option) => option.name}
      isClearable={isClearable}
      placeholder="Select a Team ..."
    />
  );
}
