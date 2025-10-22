
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Championship, Club } from '@/lib/types';
import { Filter } from '@/lib/api/types';
import { isEqual } from 'lodash';

export type TeamFilterState = {
  searchTerm: string;
  selectedChampionship: Championship | null;
  selectedClub: Club | null;
  championshipType: string;
  championshipFormat: string;
  championshipAgeCategory: string;
  championshipGender: string;
};

const initialState: TeamFilterState = {
  searchTerm: '',
  selectedChampionship: null,
  selectedClub: null,
  championshipType: '',
  championshipFormat: '',
  championshipAgeCategory: '',
  championshipGender: '',
};

export function useTeamFilters(onFilter: (filters: Filter[]) => void) {
  const [filters, setFilters] = useState<TeamFilterState>(initialState);
  const [appliedFilters, setAppliedFilters] = useState<TeamFilterState>(initialState);

  const isDirty = useMemo(() => !isEqual(filters, appliedFilters), [filters, appliedFilters]);

  const handleFilter = useCallback(() => {
    const newFilters: Filter[] = [];
    if (filters.searchTerm) {
      newFilters.push({ field: 'name', operator: 'ilike', value: `%${filters.searchTerm}%` });
    }
    if (filters.selectedChampionship) {
      newFilters.push({ field: 'championship_id', operator: 'eq', value: filters.selectedChampionship.id });
    }
    if (filters.selectedClub) {
      newFilters.push({ field: 'club_id', operator: 'eq', value: filters.selectedClub.id });
    }
    if (filters.championshipType) {
      newFilters.push({ field: 'championships.type', operator: 'eq', value: filters.championshipType });
    }
    if (filters.championshipFormat) {
      newFilters.push({ field: 'championships.format', operator: 'eq', value: filters.championshipFormat });
    }
    if (filters.championshipAgeCategory) {
      newFilters.push({ field: 'championships.age_category', operator: 'eq', value: filters.championshipAgeCategory });
    }
    if (filters.championshipGender) {
      newFilters.push({ field: 'championships.gender', operator: 'eq', value: filters.championshipGender });
    }
    onFilter(newFilters);
    setAppliedFilters(filters);
  }, [filters, onFilter]);

  const handleReset = useCallback(() => {
    setFilters(initialState);
    setAppliedFilters(initialState);
    onFilter([]);
  }, [onFilter]);

  const updateFilter = <K extends keyof TeamFilterState>(key: K, value: TeamFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return {
    filters,
    updateFilter,
    handleFilter,
    handleReset,
    isDirty,
  };
}
