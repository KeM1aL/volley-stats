"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import Select from "react-select";
import { useChampionshipFilters } from "@/hooks/use-championship-filters";
import type { ChampionshipFilters as ChampionshipFilterType } from "@/hooks/use-championship-filters";
import { useSeasonApi } from "@/hooks/use-season-api";
import { Championship, Season } from "@/lib/types";
import { useEffect, useState } from "react";

export function ChampionshipFilters() {
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
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="season">Season</Label>
            <Select
              id="season"
              options={[...seasons.map((season) => ({ value: String(season.id), label: season.name }))]}
              value={filters.seasonId ? { value: String(filters.seasonId), label: seasons.find(s => s.id === filters.seasonId)?.name || "" } : null}
              onChange={(selectedOption) => handleFilterChange("seasonId", selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder="Select a season"
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="format">Format</Label>
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
              placeholder="Select a format"
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "mixte", label: "Mixte" },
              ]}
              value={filters.gender ? { value: filters.gender, label: filters.gender } : null}
              onChange={(selectedOption) => handleFilterChange("gender", selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder="Select a gender"
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="age_category">Age Category</Label>
            <Select
              id="age_category"
              options={[
                { value: "U10", label: "U10" },
                { value: "U12", label: "U12" },
                { value: "U14", label: "U14" },
                { value: "U16", label: "U16" },
                { value: "U18", label: "U18" },
                { value: "U21", label: "U21" },
                { value: "senior", label: "Senior" },
              ]}
              value={filters.ageCategory ? { value: filters.ageCategory, label: filters.ageCategory } : null}
              onChange={(selectedOption) => handleFilterChange("ageCategory", selectedOption ? selectedOption.value : undefined)}
              isClearable
              placeholder="Select an age category"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
