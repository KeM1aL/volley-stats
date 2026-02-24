"use client";

import { useTranslations } from "next-intl";
import { Season } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useSeasonApi } from "@/hooks/use-season-api";
import { Filter } from "@/lib/api/types";

type SeasonSelectProps = {
  value: Season | null;
  onChange: (value: Season | null) => void;
  isClearable?: boolean;
  disabled?: boolean;
};

const loadOptions = async (
  inputValue: string,
  seasonApi: ReturnType<typeof useSeasonApi>,
): Promise<Season[]> => {
  try {
    const filters: Filter[] = inputValue
      ? [
          {
            field: "name",
            operator: "ilike",
            value: `${inputValue}%`,
          },
        ]
      : [];

    const seasons = await seasonApi.getSeasons(filters);
    return seasons;
  } catch (error) {
    console.error("Error fetching seasons", error);
    return [];
  }
};

export function SeasonSelect({
  value,
  onChange,
  isClearable = true,
  disabled = false,
}: SeasonSelectProps) {
  const t = useTranslations("teams");
  const seasonApi = useSeasonApi();

  return (
    <AsyncSelect<Season>
      cacheOptions
      loadOptions={(inputValue) => loadOptions(inputValue, seasonApi)}
      defaultOptions
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id.toString()}
      getOptionLabel={(option) => option.name}
      isClearable={isClearable}
      isDisabled={disabled}
      placeholder={t("seasonSelectPlaceholder")}
    />
  );
}
