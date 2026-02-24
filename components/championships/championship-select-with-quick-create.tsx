"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Championship } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useChampionshipApi } from "@/hooks/use-championship-api";
import { Filter } from "@/lib/api/types";
import { QuickCreateChampionshipDialog } from "./quick-create-championship-dialog";

type ChampionshipSelectWithQuickCreateProps = {
  value: Championship | null;
  onChange: (value: Championship | null) => void;
  isClearable?: boolean;
  disabled?: boolean;
};

type ChampionshipOption = Championship & {
  isCreateOption?: boolean;
};

const CREATE_NEW_OPTION_ID = "__create_new__";

const loadOptions = async (
  inputValue: string,
  championshipApi: ReturnType<typeof useChampionshipApi>,
): Promise<ChampionshipOption[]> => {
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

    const championships = await championshipApi.getChampionships(filters);

    const createOption: ChampionshipOption = {
      id: CREATE_NEW_OPTION_ID,
      name: "+ Create new championship...",
      type: "",
      default_match_format: "",
      age_category: "senior",
      gender: "mixte",
      user_id: "",
      season_id: null,
      ext_code: null,
      ext_source: null,
      isCreateOption: true,
    };

    return [createOption, ...championships];
  } catch (error) {
    console.error("Error fetching championships", error);
    const createOption: ChampionshipOption = {
      id: CREATE_NEW_OPTION_ID,
      name: "+ Create new championship...",
      type: "",
      default_match_format: "",
      age_category: "senior",
      gender: "mixte",
      user_id: "",
      season_id: null,
      ext_code: null,
      ext_source: null,
      isCreateOption: true,
    };
    return [createOption];
  }
};

export function ChampionshipSelectWithQuickCreate({
  value,
  onChange,
  isClearable = false,
  disabled = false,
}: ChampionshipSelectWithQuickCreateProps) {
  const t = useTranslations("common");
  const championshipApi = useChampionshipApi();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleChange = (option: ChampionshipOption | null) => {
    if (option?.isCreateOption) {
      setDialogOpen(true);
      return;
    }
    onChange(option);
  };

  const handleChampionshipCreated = (championshipId: string) => {
    championshipApi.getChampionship(championshipId).then((newChampionship) => {
      if (newChampionship) {
        onChange(newChampionship);
      }
    });
  };

  const formatOptionLabel = (option: ChampionshipOption) => {
    if (option.isCreateOption) {
      return (
        <span className="text-primary font-medium">{option.name}</span>
      );
    }

    return option.name;
  };

  return (
    <>
      <AsyncSelect<ChampionshipOption>
        cacheOptions
        loadOptions={(inputValue) => loadOptions(inputValue, championshipApi)}
        defaultOptions
        value={value}
        onChange={handleChange}
        onInputChange={(newValue) => setInputValue(newValue)}
        getOptionValue={(option) => option.id.toString()}
        getOptionLabel={(option) => option.name || ""}
        formatOptionLabel={formatOptionLabel}
        isClearable={isClearable}
        isDisabled={disabled}
        placeholder={t("ui.selectChampionship")}
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

      <QuickCreateChampionshipDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleChampionshipCreated}
        defaultName={inputValue}
      />
    </>
  );
}
