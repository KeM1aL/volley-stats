"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Select from "react-select";
import { useChampionshipFilters } from "@/hooks/use-championship-filters";
import type { ChampionshipFilters as ChampionshipFilterType } from "@/hooks/use-championship-filters";
import { useSeasonApi } from "@/hooks/use-season-api";
import { Championship, Season } from "@/lib/types";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export function ChampionshipFilters() {
  const t = useTranslations("championships");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const seasonApi = useSeasonApi();
  const { filters, setFilters } = useChampionshipFilters();

  useEffect(() => {
    const fetchAndSetDefaultSeason = async () => {
      const data = await seasonApi.getSeasons();
      setSeasons(data || []);

      const currentDate = new Date();
      const currentSeason = data?.find(
        (season) =>
          new Date(season.start_date) <= currentDate &&
          new Date(season.end_date) >= currentDate
      );

      if (currentSeason) {
        setFilters({ ...filters, seasonId: currentSeason.id });
      }
    };

    fetchAndSetDefaultSeason();
  }, [seasonApi, setFilters]);

  const handleFilterChange = (key: keyof ChampionshipFilterType, value: string | undefined) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleFormatChange = (value: string | undefined) => {
    setFilters({
      ...filters,
      match_formats: value ? { format: value } : undefined
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("filters.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="season">{t("filters.season")}</Label>
            <Select
              id="season"
              options={[...seasons.map((season) => ({ value: String(season.id), label: season.name }))]}
              value={filters.seasonId ? { value: String(filters.seasonId), label: seasons.find(s => s.id === filters.seasonId)?.name || "" } : null}
              onChange={(selectedOption) => handleFilterChange("seasonId", selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder={t("filters.selectSeason")}
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="format">{t("filters.format")}</Label>
            <Select
              id="format"
              options={[
                { value: "2x2", label: "2x2" },
                { value: "3x3", label: "3x3" },
                { value: "4x4", label: "4x4" },
                { value: "6x6", label: "6x6" },
              ]}
              value={filters.match_formats?.format ? { value: filters.match_formats?.format, label: filters.match_formats?.format } : null}
              onChange={(selectedOption) => handleFormatChange(selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder={t("filters.selectFormat")}
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="gender">{t("filters.gender")}</Label>
            <Select
              id="gender"
              options={[
                { value: "female", label: t("gender.female") },
                { value: "male", label: t("gender.male") },
                { value: "mixte", label: t("gender.mixte") },
              ]}
              value={filters.gender ? { value: filters.gender, label: t(`gender.${filters.gender}`) } : null}
              onChange={(selectedOption) => handleFilterChange("gender", selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder={t("filters.selectGender")}
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="age_category">{t("filters.ageCategory")}</Label>
            <Select
              id="age_category"
              options={[
                { value: "U10", label: t("ageCategory.u10") },
                { value: "U12", label: t("ageCategory.u12") },
                { value: "U14", label: t("ageCategory.u14") },
                { value: "U16", label: t("ageCategory.u16") },
                { value: "U18", label: t("ageCategory.u18") },
                { value: "U21", label: t("ageCategory.u21") },
                { value: "senior", label: t("ageCategory.senior") },
              ]}
              value={filters.ageCategory ? { value: filters.ageCategory, label: t(`ageCategory.${filters.ageCategory.toLowerCase()}`) } : null}
              onChange={(selectedOption) => handleFilterChange("ageCategory", selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder={t("filters.selectAgeCategory")}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
