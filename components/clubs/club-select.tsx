'use client';

import { Club } from "@/lib/types";
import AsyncSelect from "react-select/async";
import { useClubApi } from "@/hooks/use-club-api";
import { useTranslations } from "next-intl";

type ClubSelectProps = {
  value: Club | null;
  onChange: (value: Club | null) => void;
  isClearable?: boolean;
};

const loadOptions = async (inputValue: string, clubApi: ReturnType<typeof useClubApi>): Promise<Club[]> => {
  try {
    const clubs = await clubApi.getClubs([{
      field: "name",
      operator: "ilike",
      value: `${inputValue}%`
    }]);
    return clubs;
  } catch (error) {
    console.error("Error fetching clubs", error);
    return [];
  }
};

export function ClubSelect({
  value,
  onChange,
  isClearable = false,
}: ClubSelectProps) {
  const t = useTranslations("clubs");
  const clubApi = useClubApi();

  return (
    <AsyncSelect
      cacheOptions
      loadOptions={(inputValue) => loadOptions(inputValue, clubApi)}
      defaultOptions
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id.toString()}
      getOptionLabel={(option) => option.name}
      isClearable={isClearable}
      placeholder={t("selectClub")}
    />
  );
};
