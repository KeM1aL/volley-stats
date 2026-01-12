"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useTeamApi } from "@/hooks/use-team-api";
import { Filter } from "@/lib/api/types";
import { QuickCreateTeamDialog } from "./quick-create-team-dialog";

type TeamSelectWithQuickCreateProps = {
  value: Team | null;
  onChange: (value: Team | null) => void;
  isClearable?: boolean;
  disabled?: boolean;
  defaultChampionshipId?: string | null;
};

type TeamOption = Team & {
  isCreateOption?: boolean;
};

const CREATE_NEW_OPTION_ID = "__create_new__";

const loadOptions = async (
  inputValue: string,
  teamApi: ReturnType<typeof useTeamApi>,
): Promise<TeamOption[]> => {
  try {
    const filters: Filter[] = inputValue
      ? [
          {
            field: "name",
            operator: "ilike",
            value: `%${inputValue}%`,
          },
        ]
      : [];

    const teams = await teamApi.getTeams(filters);

    // Add "Create new" option at the beginning
    const createOption: TeamOption = {
      id: CREATE_NEW_OPTION_ID,
      name: "+ Create new team...",
      status: "incomplete",
      club_id: null,
      championship_id: null,
      ext_code: null,
      ext_source: null,
      created_at: "",
      updated_at: "",
      user_id: null,
      isCreateOption: true,
    };

    return [createOption, ...teams];
  } catch (error) {
    console.error("Error fetching teams", error);
    const createOption: TeamOption = {
      id: CREATE_NEW_OPTION_ID,
      name: "+ Create new team...",
      status: "incomplete",
      club_id: null,
      championship_id: null,
      ext_code: null,
      ext_source: null,
      created_at: "",
      updated_at: "",
      user_id: null,
      isCreateOption: true,
    };
    return [createOption];
  }
};

export function TeamSelectWithQuickCreate({
  value,
  onChange,
  isClearable = false,
  disabled = false,
  defaultChampionshipId,
}: TeamSelectWithQuickCreateProps) {
  const teamApi = useTeamApi();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleChange = (option: TeamOption | null) => {
    if (option?.isCreateOption) {
      // User clicked "Create new", open the dialog
      setDialogOpen(true);
      return;
    }
    onChange(option);
  };

  const handleTeamCreated = (teamId: string) => {
    // Fetch the newly created team and auto-select it
    teamApi.getTeam(teamId).then((newTeam) => {
      if (newTeam) {
        onChange(newTeam);
      }
    });
  };

  const formatOptionLabel = (option: TeamOption) => {
    if (option.isCreateOption) {
      return (
        <span className="text-primary font-medium">{option.name}</span>
      );
    }

    return option.name;
  };

  return (
    <>
      <AsyncSelect<TeamOption>
        cacheOptions
        loadOptions={(inputValue) => loadOptions(inputValue, teamApi)}
        defaultOptions
        value={value}
        onChange={handleChange}
        onInputChange={(newValue) => setInputValue(newValue)}
        getOptionValue={(option) => option.id.toString()}
        getOptionLabel={(option) => option.name || ""}
        formatOptionLabel={formatOptionLabel}
        isClearable={isClearable}
        isDisabled={disabled}
        placeholder="Select team..."
        styles={{
          option: (provided, state) => ({
            ...provided,
            ...(state.data?.isCreateOption
              ? {
                  backgroundColor: state.isFocused ? "#f0f9ff" : "white",
                  cursor: "pointer",
                }
              : {}),
          }),
        }}
      />

      <QuickCreateTeamDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleTeamCreated}
        defaultChampionshipId={defaultChampionshipId}
        defaultName={inputValue}
      />
    </>
  );
}
