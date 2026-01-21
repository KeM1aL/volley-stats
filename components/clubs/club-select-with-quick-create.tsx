"use client";

import { useState } from "react";
import { Club } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useClubApi } from "@/hooks/use-club-api";
import { Filter } from "@/lib/api/types";
import { QuickCreateClubDialog } from "./quick-create-club-dialog";

type ClubSelectWithQuickCreateProps = {
  value: Club | null;
  onChange: (value: Club | null) => void;
  isClearable?: boolean;
  disabled?: boolean;
};

type ClubOption = Club & {
  isCreateOption?: boolean;
};

const CREATE_NEW_OPTION_ID = "__create_new__";

const loadOptions = async (
  inputValue: string,
  clubApi: ReturnType<typeof useClubApi>,
): Promise<ClubOption[]> => {
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

    const clubs = await clubApi.getClubs(filters);

    const createOption: ClubOption = {
      id: CREATE_NEW_OPTION_ID,
      name: "+ Create new club...",
      user_id: "",
      website: null,
      contact_email: null,
      contact_phone: null,
      isCreateOption: true,
    };

    return [createOption, ...clubs];
  } catch (error) {
    console.error("Error fetching clubs", error);
    const createOption: ClubOption = {
      id: CREATE_NEW_OPTION_ID,
      name: "+ Create new club...",
      user_id: "",
      website: null,
      contact_email: null,
      contact_phone: null,
      isCreateOption: true,
    };
    return [createOption];
  }
};

export function ClubSelectWithQuickCreate({
  value,
  onChange,
  isClearable = false,
  disabled = false,
}: ClubSelectWithQuickCreateProps) {
  const clubApi = useClubApi();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleChange = (option: ClubOption | null) => {
    if (option?.isCreateOption) {
      setDialogOpen(true);
      return;
    }
    onChange(option);
  };

  const handleClubCreated = (clubId: string) => {
    clubApi.getClubById(clubId).then((newClub) => {
      if (newClub) {
        onChange(newClub);
      }
    });
  };

  const formatOptionLabel = (option: ClubOption) => {
    if (option.isCreateOption) {
      return (
        <span className="text-primary font-medium">{option.name}</span>
      );
    }

    return option.name;
  };

  return (
    <>
      <AsyncSelect<ClubOption>
        cacheOptions
        loadOptions={(inputValue) => loadOptions(inputValue, clubApi)}
        defaultOptions
        value={value}
        onChange={handleChange}
        onInputChange={(newValue) => setInputValue(newValue)}
        getOptionValue={(option) => option.id.toString()}
        getOptionLabel={(option) => option.name || ""}
        formatOptionLabel={formatOptionLabel}
        isClearable={isClearable}
        isDisabled={disabled}
        placeholder="Select a club..."
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

      <QuickCreateClubDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleClubCreated}
        defaultName={inputValue}
      />
    </>
  );
}
