import { ChampionshipFormat } from "../enums";
import { PlayerPosition, PlayerRole } from "../enums";

/**
 * Team Template Schema
 * Used for pre-built team configurations in the onboarding wizard
 */
export type TeamTemplate = {
  id: string;
  name: string;
  nameKey: string; // i18n key for translated name
  description: string;
  descriptionKey: string; // i18n key for translated description
  format: '2x2' | '3x3' | '4x4' | '6x6';
  suggestedPlayerCount: number;
  defaultPositions: PlayerPosition[];
  defaultRoles?: PlayerRole[];
};

/**
 * Pre-built team templates for different volleyball formats
 */
export const teamTemplates: TeamTemplate[] = [
  {
    id: "indoor-6v6",
    name: "Indoor 6v6",
    nameKey: "onboarding.templates.team.indoor6v6.name",
    description: "Standard indoor volleyball with 6 players per side. Full rotation and all positions.",
    descriptionKey: "onboarding.templates.team.indoor6v6.description",
    format: ChampionshipFormat.SIX_X_SIX,
    suggestedPlayerCount: 12,
    defaultPositions: [
      PlayerPosition.P1,
      PlayerPosition.P2,
      PlayerPosition.P3,
      PlayerPosition.P4,
      PlayerPosition.P5,
      PlayerPosition.P6,
    ],
    defaultRoles: [
      PlayerRole.SETTER,
      PlayerRole.OPPOSITE,
      PlayerRole.OUTSIDE_HITTER,
      PlayerRole.OUTSIDE_HITTER,
      PlayerRole.MIDDLE_HITTER,
      PlayerRole.MIDDLE_HITTER,
    ],
  },
  {
    id: "recreational-4v4",
    name: "Recreational 4v4",
    nameKey: "onboarding.templates.team.recreational4v4.name",
    description: "Casual 4-player format. Great for recreational leagues and smaller teams.",
    descriptionKey: "onboarding.templates.team.recreational4v4.description",
    format: ChampionshipFormat.FOUR_X_FOUR,
    suggestedPlayerCount: 8,
    defaultPositions: [
      PlayerPosition.P1,
      PlayerPosition.P2,
      PlayerPosition.P3,
      PlayerPosition.P4,
    ],
    defaultRoles: [
      PlayerRole.SETTER,
      PlayerRole.OUTSIDE_HITTER,
      PlayerRole.OUTSIDE_HITTER,
      PlayerRole.MIDDLE_HITTER,
    ],
  },
  {
    id: "beach-2v2",
    name: "Beach 2v2",
    nameKey: "onboarding.templates.team.beach2v2.name",
    description: "Beach volleyball pairs format. No rotation, simplified gameplay.",
    descriptionKey: "onboarding.templates.team.beach2v2.description",
    format: ChampionshipFormat.TWO_X_TWO,
    suggestedPlayerCount: 2,
    defaultPositions: [
      PlayerPosition.P1,
      PlayerPosition.P2,
    ],
    defaultRoles: [],
  },
];

/**
 * Get all available team templates
 */
export function getAllTeamTemplates(): TeamTemplate[] {
  return teamTemplates;
}

/**
 * Get a team template by its ID
 * @param id - The template ID to find
 * @returns The matching template or undefined
 */
export function getTeamTemplateById(id: string): TeamTemplate | undefined {
  return teamTemplates.find((template) => template.id === id);
}

/**
 * Get team templates filtered by format
 * @param format - The format to filter by (e.g., '6x6', '4x4', '2x2')
 * @returns Array of templates matching the format
 */
export function getTeamTemplatesByFormat(format: TeamTemplate['format']): TeamTemplate[] {
  return teamTemplates.filter((template) => template.format === format);
}

/**
 * Factory function to create team data from a template
 * @param template - The template to use
 * @param overrides - Optional overrides for the generated team
 * @returns Partial team data ready for creation
 */
export function createTeamFromTemplate(
  template: TeamTemplate,
  overrides?: {
    name?: string;
    clubId?: string;
    championshipId?: string;
  }
): {
  name: string;
  status: 'incomplete';
  club_id: string | null;
  championship_id: string | null;
  suggestedFormat: TeamTemplate['format'];
  suggestedPlayerCount: number;
  defaultPositions: PlayerPosition[];
  defaultRoles?: PlayerRole[];
} {
  return {
    name: overrides?.name ?? template.name,
    status: 'incomplete',
    club_id: overrides?.clubId ?? null,
    championship_id: overrides?.championshipId ?? null,
    suggestedFormat: template.format,
    suggestedPlayerCount: template.suggestedPlayerCount,
    defaultPositions: [...template.defaultPositions],
    defaultRoles: template.defaultRoles ? [...template.defaultRoles] : undefined,
  };
}

/**
 * Generate default player slots based on a team template
 * @param template - The template to use
 * @returns Array of player slot configurations
 */
export function generatePlayerSlotsFromTemplate(
  template: TeamTemplate
): Array<{
  number: number;
  position: PlayerPosition | null;
  role: PlayerRole | null;
  name: string;
}> {
  const slots: Array<{
    number: number;
    position: PlayerPosition | null;
    role: PlayerRole | null;
    name: string;
  }> = [];

  for (let i = 0; i < template.suggestedPlayerCount; i++) {
    const position = template.defaultPositions[i % template.defaultPositions.length] ?? null;
    const role = template.defaultRoles?.[i % (template.defaultRoles?.length || 1)] ?? null;

    slots.push({
      number: i + 1,
      position,
      role,
      name: `Player ${i + 1}`,
    });
  }

  return slots;
}
