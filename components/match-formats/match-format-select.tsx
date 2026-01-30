"use client";

import { useState } from "react";
import { MatchFormat } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useMatchFormatApi } from "@/hooks/use-match-format-api";
import { Filter } from "@/lib/api/types";
import { NewMatchFormatDialog } from "./new-match-format-dialog";
import { useTranslations } from "next-intl";

type MatchFormatSelectProps = {
  value: MatchFormat | null;
  onChange: (value: MatchFormat | null) => void;
  isClearable?: boolean;
  disabled?: boolean;
};

type MatchFormatOption = MatchFormat & {
  isCreateOption?: boolean;
};

const CREATE_NEW_OPTION_ID = "__create_new__";

const loadOptions = async (
  inputValue: string,
  matchFormatApi: ReturnType<typeof useMatchFormatApi>,
  createOptionLabel: string,
): Promise<MatchFormatOption[]> => {
  try {
    const filters: Filter[] = inputValue
      ? [
          {
            field: "description",
            operator: "ilike",
            value: `%${inputValue}%`,
          },
        ]
      : [];

    const matchFormats = await matchFormatApi.getMatchFormats(filters);

    // Add "Create new" option at the beginning
    const createOption: MatchFormatOption = {
      id: CREATE_NEW_OPTION_ID,
      description: createOptionLabel,
      format: "6x6",
      sets_to_win: 0,
      rotation: false,
      point_by_set: 0,
      point_final_set: 0,
      decisive_point: false,
      created_at: "",
      updated_at: "",
      isCreateOption: true,
    };

    return [createOption, ...matchFormats];
  } catch (error) {
    console.error("Error fetching match formats", error);
    const createOption: MatchFormatOption = {
      id: CREATE_NEW_OPTION_ID,
      description: createOptionLabel,
      format: "6x6",
      sets_to_win: 0,
      rotation: false,
      point_by_set: 0,
      point_final_set: 0,
      decisive_point: false,
      created_at: "",
      updated_at: "",
      isCreateOption: true,
    };
    return [createOption];
  }
};

export function MatchFormatSelect({
  value,
  onChange,
  isClearable = false,
  disabled = false,
}: MatchFormatSelectProps) {
  const t = useTranslations("match-formats");
  const matchFormatApi = useMatchFormatApi();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleChange = (option: MatchFormatOption | null) => {
    if (option?.isCreateOption) {
      // User clicked "Create new", open the dialog
      setDialogOpen(true);
      return;
    }
    onChange(option);
  };

  const handleFormatCreated = (newFormat: MatchFormat) => {
    // Auto-select the newly created format
    onChange(newFormat);
  };

  const formatOptionLabel = (option: MatchFormatOption) => {
    if (option.isCreateOption) {
      return (
        <span className="text-primary font-medium">{option.description}</span>
      );
    }

    // Show description and format (e.g., "Standard 6x6 - Best of 5")
    return `${option.description} (${option.format})`;
  };

  return (
    <>
      <AsyncSelect<MatchFormatOption>
        cacheOptions
        loadOptions={(inputValue) => loadOptions(inputValue, matchFormatApi, t("description"))}
        defaultOptions
        value={value}
        onChange={handleChange}
        getOptionValue={(option) => option.id.toString()}
        getOptionLabel={(option) => option.description || ""}
        formatOptionLabel={formatOptionLabel}
        isClearable={isClearable}
        isDisabled={disabled}
        placeholder={t("selectPlaceholder")}
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

      <NewMatchFormatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleFormatCreated}
      />
    </>
  );
}
