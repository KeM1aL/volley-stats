'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ChampionshipAgeCategory,
  ChampionshipFormat,
  ChampionshipGender,
  ChampionshipType,
} from '@/lib/enums';
import { ChampionshipSelect } from '@/components/championships/championship-select';
import { ClubSelect } from '@/components/clubs/club-select';
import { GenericSelect } from '@/components/ui/generic-select';
import { useTeamFilters } from '@/hooks/use-team-filters';
import { Filter } from '@/lib/api/types';
import { useDebounce } from '@/hooks/use-debounce';

type TeamFiltersProps = {
  onFilterChange: (filters: Filter[]) => void;
};

export function TeamFilters({ onFilterChange }: TeamFiltersProps) {
  const {
    filters,
    updateFilter,
    handleReset,
  } = useTeamFilters(onFilterChange);

  const [searchTermInput, setSearchTermInput] = useState(filters.searchTerm);
  const debouncedSearchTerm = useDebounce(searchTermInput, 500); // 500ms debounce delay

  // Effect to update the global filter state after debounce
  useEffect(() => {
    // Only update if the debounced term is different from the current filter to prevent unnecessary updates
    if (debouncedSearchTerm !== filters.searchTerm) {
      updateFilter('searchTerm', debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, updateFilter, filters.searchTerm]);

  // Effect to synchronize local input state with global filter state (e.g., on reset)
  useEffect(() => {
    setSearchTermInput(filters.searchTerm);
  }, [filters.searchTerm]);

  const championshipTypeOptions = Object.values(ChampionshipType).map((value) => ({
    label: value,
    value: value,
  }));

  const championshipFormatOptions = Object.values(ChampionshipFormat).map((value) => ({
    label: value,
    value: value,
  }));

  const championshipAgeCategoryOptions = Object.values(ChampionshipAgeCategory).map((value) => ({
    label: value,
    value: value,
  }));

  const championshipGenderOptions = Object.values(ChampionshipGender).map((value) => ({
    label: value,
    value: value,
  }));

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Filter Teams</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Input
          placeholder="Search by team name..."
          value={searchTermInput}
          onChange={(e) => setSearchTermInput(e.target.value)}
        />
        <ChampionshipSelect
          value={filters.selectedChampionship}
          onChange={(value) => updateFilter('selectedChampionship', value)}
          isClearable
        />
        <ClubSelect
          value={filters.selectedClub}
          onChange={(value) => updateFilter('selectedClub', value)}
          isClearable
        />
        <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GenericSelect
            options={championshipTypeOptions}
            placeholder="Select Championship Type"
            value={filters.championshipType}
            onValueChange={(value) => updateFilter('championshipType', value)}
            isClearable
          />
          <GenericSelect
            options={championshipFormatOptions}
            placeholder="Select Championship Format"
            value={filters.championshipFormat}
            onValueChange={(value) => updateFilter('championshipFormat', value)}
            isClearable
          />
          <GenericSelect
            options={championshipAgeCategoryOptions}
            placeholder="Select Age Category"
            value={filters.championshipAgeCategory}
            onValueChange={(value) => updateFilter('championshipAgeCategory', value)}
            isClearable
          />
          <GenericSelect
            options={championshipGenderOptions}
            placeholder="Select Gender"
            value={filters.championshipGender}
            onValueChange={(value) => updateFilter('championshipGender', value)}
            isClearable
          />
        </div>
      </div>
      <div className="flex justify-end gap-4">
        <Button onClick={handleReset} variant="outline">
          Reset
        </Button>
      </div>
    </div>
  );
}
