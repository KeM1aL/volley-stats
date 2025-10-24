import { create } from 'zustand';

export type ChampionshipFilters = {
  seasonId?: number;
  format?: string;
  gender?: string;
  ageCategory?: string;
};

type ChampionshipFilterStore = {
  filters: ChampionshipFilters;
  setFilters: (filters: ChampionshipFilters) => void;
};

export const useChampionshipFilters = create<ChampionshipFilterStore>((set) => ({
  filters: {},
  setFilters: (filters) => set({ filters }),
}));
