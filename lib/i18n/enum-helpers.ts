import { useTranslations } from 'next-intl';

export function usePlayerRoleOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'setter', label: t('playerRole.setter') },
    { value: 'opposite', label: t('playerRole.opposite') },
    { value: 'outside_hitter', label: t('playerRole.outside_hitter') },
    { value: 'middle_hitter', label: t('playerRole.middle_hitter') },
    { value: 'libero', label: t('playerRole.libero') },
  ];
}

export function useTeamStatusOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'incomplete', label: t('teamStatus.incomplete') },
    { value: 'active', label: t('teamStatus.active') },
    { value: 'archived', label: t('teamStatus.archived') },
  ];
}

export function useTeamMemberRoleOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'player', label: t('teamMemberRole.player') },
    { value: 'coach', label: t('teamMemberRole.coach') },
    { value: 'owner', label: t('teamMemberRole.owner') },
    { value: 'staff', label: t('teamMemberRole.staff') },
  ];
}

export function useMatchStatusOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'upcoming', label: t('matchStatus.upcoming') },
    { value: 'live', label: t('matchStatus.live') },
    { value: 'completed', label: t('matchStatus.completed') },
  ];
}

export function useChampionshipTypeOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'regional', label: t('championshipType.regional') },
    { value: 'departmental', label: t('championshipType.departmental') },
    { value: 'national', label: t('championshipType.national') },
  ];
}

export function useChampionshipFormatOptions() {
  const t = useTranslations('enums');
  return [
    { value: '2x2', label: t('championshipFormat.2x2') },
    { value: '3x3', label: t('championshipFormat.3x3') },
    { value: '4x4', label: t('championshipFormat.4x4') },
    { value: '6x6', label: t('championshipFormat.6x6') },
  ];
}

export function useChampionshipAgeCategoryOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'U10', label: t('championshipAgeCategory.U10') },
    { value: 'U12', label: t('championshipAgeCategory.U12') },
    { value: 'U14', label: t('championshipAgeCategory.U14') },
    { value: 'U16', label: t('championshipAgeCategory.U16') },
    { value: 'U18', label: t('championshipAgeCategory.U18') },
    { value: 'U21', label: t('championshipAgeCategory.U21') },
    { value: 'senior', label: t('championshipAgeCategory.senior') },
  ];
}

export function useChampionshipGenderOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'male', label: t('championshipGender.male') },
    { value: 'female', label: t('championshipGender.female') },
    { value: 'mixte', label: t('championshipGender.mixte') },
  ];
}

export function usePlayerPositionOptions() {
  const t = useTranslations('enums');
  return [
    { value: 'p1', label: t('playerPosition.p1') },
    { value: 'p2', label: t('playerPosition.p2') },
    { value: 'p3', label: t('playerPosition.p3') },
    { value: 'p4', label: t('playerPosition.p4') },
    { value: 'p5', label: t('playerPosition.p5') },
    { value: 'p6', label: t('playerPosition.p6') },
  ];
}
