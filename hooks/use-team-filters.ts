
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Championship, Club, Team } from '@/lib/types';
import { Filter } from '@/lib/api/types';
import { isEqual } from 'lodash';
import { useDebounce } from './use-debounce';

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

export function useTeamFilters(onFilter: (filters: Filter[]) => void, initialFilters?: Partial<TeamFilterState>) {
  const [filters, setFilters] = useState<TeamFilterState>(initialState);
  const [appliedFilters, setAppliedFilters] = useState<TeamFilterState>(initialState);
  const initialFiltersAppliedRef = useRef(false);
  const isFirstFilterCall = useRef(true);

  const isDirty = useMemo(() => !isEqual(filters, appliedFilters), [filters, appliedFilters]);

  // Apply initial filters when they become available (e.g., after user data loads)
  useEffect(() => {
    if (initialFilters && !initialFiltersAppliedRef.current) {
      console.log(initialFilters.searchTerm);
      const hasInitialValues = initialFilters.selectedClub || initialFilters.searchTerm || initialFilters.selectedChampionship;

      // Only apply if there are initial values
      if (hasInitialValues) {
        setFilters((prev) => ({ ...prev, ...initialFilters }));
        initialFiltersAppliedRef.current = true;
      }
    }
  }, [initialFilters]);

  // Debounce the filters state before applying them
  const debouncedFilters = useDebounce(filters, 200); // 200ms debounce for all filters

  // Effect to apply filters when debouncedFilters change
  useEffect(() => {
    // Skip first onFilter call if we have initialFilters to apply
    // This prevents calling onFilter([]) before initialFilters are applied
    if (isFirstFilterCall.current && initialFilters) {
      const hasInitialValues = initialFilters.selectedClub || initialFilters.searchTerm || initialFilters.selectedChampionship;
      if (hasInitialValues) {
        isFirstFilterCall.current = false;
        return;
      }
    }
    isFirstFilterCall.current = false;

    const newFilters: Filter[] = [];
    if (debouncedFilters.searchTerm) {
      newFilters.push({ field: 'name', operator: 'ilike', value: `%${debouncedFilters.searchTerm}%` });
    }
    if (debouncedFilters.selectedChampionship) {
      newFilters.push({ field: 'championship_id', operator: 'eq', value: debouncedFilters.selectedChampionship.id });
    }
    if (debouncedFilters.selectedClub) {
      newFilters.push({ field: 'club_id', operator: 'eq', value: debouncedFilters.selectedClub.id });
    }
    if (debouncedFilters.championshipType) {
      newFilters.push({ field: 'championships.type', operator: 'eq', value: debouncedFilters.championshipType });
    }
    if (debouncedFilters.championshipFormat) {
      newFilters.push({ field: 'championships.match_formats.format', operator: 'eq', value: debouncedFilters.championshipFormat });
    }
    if (debouncedFilters.championshipAgeCategory) {
      newFilters.push({ field: 'championships.age_category', operator: 'eq', value: debouncedFilters.championshipAgeCategory });
    }
    if (debouncedFilters.championshipGender) {
      newFilters.push({ field: 'championships.gender', operator: 'eq', value: debouncedFilters.championshipGender });
    }
    onFilter(newFilters);
    setAppliedFilters(debouncedFilters); // Update applied filters after debounce
  }, [debouncedFilters, onFilter]);

  const handleReset = useCallback(() => {
    setFilters(initialState);
    // setAppliedFilters(initialState); // This will be handled by the useEffect above
    // onFilter([]); // This will be handled by the useEffect above
  }, []); // Removed onFilter from dependencies as it's handled by useEffect

  const updateFilter = <K extends keyof TeamFilterState>(key: K, value: TeamFilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return {
    filters,
    updateFilter,
    handleReset,
    isDirty,
  };
}
