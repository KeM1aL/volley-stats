'use client';

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

type TeamFiltersProps = {
  onFilterChange: (filters: Filter[]) => void;
};

export function TeamFilters({ onFilterChange }: TeamFiltersProps) {
  const {
    filters,
    updateFilter,
    handleFilter,
    handleReset,
    isDirty,
  } = useTeamFilters(onFilterChange);

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Input
          placeholder="Search by team name..."
          value={filters.searchTerm}
          onChange={(e) => updateFilter('searchTerm', e.target.value)}
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
      <div className="flex justify-end gap-4">
        <Button onClick={handleFilter} disabled={!isDirty} variant={isDirty ? 'default' : 'outline'}>
          Search
        </Button>
        <Button onClick={handleReset} variant="outline">
          Reset
        </Button>
      </div>
    </div>
  );
}