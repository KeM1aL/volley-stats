import { ChampionshipFormat } from "../enums";
import { MatchFormat } from "../types";

/**
 * Match Format Template Schema
 * Used for pre-built match format configurations in the onboarding wizard
 */
export type MatchFormatTemplate = {
  id: string;
  name: string;
  nameKey: string; // i18n key for translated name
  description: string;
  descriptionKey: string; // i18n key for translated description
  format: '2x2' | '3x3' | '4x4' | '6x6';
  sets_to_win: number;
  point_by_set: number;
  point_final_set: number;
  decisive_point: boolean;
  rotation: boolean;
};

/**
 * Pre-built match format templates for different volleyball formats
 */
export const matchFormatTemplates: MatchFormatTemplate[] = [
  // 6x6 Indoor Formats
  {
    id: "indoor-6v6-best-of-3",
    name: "Indoor 6v6 - Best of 3",
    nameKey: "onboarding.templates.matchFormat.indoor6v6BestOf3.name",
    description: "Standard indoor match with 3 sets. First to 25 points, final set to 15. Most common format.",
    descriptionKey: "onboarding.templates.matchFormat.indoor6v6BestOf3.description",
    format: ChampionshipFormat.SIX_X_SIX,
    sets_to_win: 2,
    point_by_set: 25,
    point_final_set: 15,
    decisive_point: true,
    rotation: true,
  },
  {
    id: "indoor-6v6-best-of-5",
    name: "Indoor 6v6 - Best of 5",
    nameKey: "onboarding.templates.matchFormat.indoor6v6BestOf5.name",
    description: "Professional indoor match with 5 sets. First to 25 points, final set to 15. Used in high-level competitions.",
    descriptionKey: "onboarding.templates.matchFormat.indoor6v6BestOf5.description",
    format: ChampionshipFormat.SIX_X_SIX,
    sets_to_win: 3,
    point_by_set: 25,
    point_final_set: 15,
    decisive_point: true,
    rotation: true,
  },
  // 4x4 Formats
  {
    id: "recreational-4v4-best-of-3",
    name: "Recreational 4v4 - Best of 3",
    nameKey: "onboarding.templates.matchFormat.recreational4v4BestOf3.name",
    description: "Casual 4-player format. Sets to 21 points, final set to 15. Great for recreational leagues.",
    descriptionKey: "onboarding.templates.matchFormat.recreational4v4BestOf3.description",
    format: ChampionshipFormat.FOUR_X_FOUR,
    sets_to_win: 2,
    point_by_set: 21,
    point_final_set: 15,
    decisive_point: true,
    rotation: true,
  },
  // 3x3 Formats
  {
    id: "triples-3v3-best-of-3",
    name: "Triples 3v3 - Best of 3",
    nameKey: "onboarding.templates.matchFormat.triples3v3BestOf3.name",
    description: "Three-player format. Sets to 21 points, final set to 15. Faster-paced games.",
    descriptionKey: "onboarding.templates.matchFormat.triples3v3BestOf3.description",
    format: ChampionshipFormat.THREE_X_THREE,
    sets_to_win: 2,
    point_by_set: 21,
    point_final_set: 15,
    decisive_point: true,
    rotation: true,
  },
  // 2x2 Beach Formats
  {
    id: "beach-2v2-best-of-3",
    name: "Beach 2v2 - Best of 3",
    nameKey: "onboarding.templates.matchFormat.beach2v2BestOf3.name",
    description: "Beach volleyball pairs. Sets to 21 points, final set to 15. No rotation required.",
    descriptionKey: "onboarding.templates.matchFormat.beach2v2BestOf3.description",
    format: ChampionshipFormat.TWO_X_TWO,
    sets_to_win: 2,
    point_by_set: 21,
    point_final_set: 15,
    decisive_point: true,
    rotation: false,
  },
  // Youth/Training Formats
  {
    id: "youth-6v6-short",
    name: "Youth 6v6 - Short Format",
    nameKey: "onboarding.templates.matchFormat.youth6v6Short.name",
    description: "Shorter sets for youth training. Sets to 21 points, final set to 15. Ideal for younger players.",
    descriptionKey: "onboarding.templates.matchFormat.youth6v6Short.description",
    format: ChampionshipFormat.SIX_X_SIX,
    sets_to_win: 2,
    point_by_set: 21,
    point_final_set: 15,
    decisive_point: true,
    rotation: true,
  },
  // Timed/Practice Formats
  {
    id: "practice-single-set",
    name: "Practice - Single Set",
    nameKey: "onboarding.templates.matchFormat.practiceSingleSet.name",
    description: "Single set to 25 points. Perfect for practice sessions and quick games.",
    descriptionKey: "onboarding.templates.matchFormat.practiceSingleSet.description",
    format: ChampionshipFormat.SIX_X_SIX,
    sets_to_win: 1,
    point_by_set: 25,
    point_final_set: 25,
    decisive_point: false,
    rotation: true,
  },
];

/**
 * Get all available match format templates
 */
export function getAllMatchFormatTemplates(): MatchFormatTemplate[] {
  return matchFormatTemplates;
}

/**
 * Get a match format template by its ID
 * @param id - The template ID to find
 * @returns The matching template or undefined
 */
export function getMatchFormatTemplateById(id: string): MatchFormatTemplate | undefined {
  return matchFormatTemplates.find((template) => template.id === id);
}

/**
 * Get match format templates filtered by format
 * @param format - The format to filter by (e.g., '6x6', '4x4', '2x2')
 * @returns Array of templates matching the format
 */
export function getMatchFormatTemplatesByFormat(format: MatchFormatTemplate['format']): MatchFormatTemplate[] {
  return matchFormatTemplates.filter((template) => template.format === format);
}

/**
 * Get match format templates that use rotation
 * @returns Array of templates with rotation enabled
 */
export function getMatchFormatTemplatesWithRotation(): MatchFormatTemplate[] {
  return matchFormatTemplates.filter((template) => template.rotation);
}

/**
 * Factory function to create match format data from a template
 * @param template - The template to use
 * @param overrides - Optional overrides for the generated match format
 * @returns Partial match format data ready for creation (without id and timestamps)
 */
export function createMatchFormatFromTemplate(
  template: MatchFormatTemplate,
  overrides?: {
    description?: string;
    format?: MatchFormatTemplate['format'];
    sets_to_win?: number;
    point_by_set?: number;
    point_final_set?: number;
    decisive_point?: boolean;
    rotation?: boolean;
  }
): Omit<MatchFormat, 'id' | 'created_at' | 'updated_at'> {
  return {
    description: overrides?.description ?? template.description,
    format: overrides?.format ?? template.format,
    sets_to_win: overrides?.sets_to_win ?? template.sets_to_win,
    point_by_set: overrides?.point_by_set ?? template.point_by_set,
    point_final_set: overrides?.point_final_set ?? template.point_final_set,
    decisive_point: overrides?.decisive_point ?? template.decisive_point,
    rotation: overrides?.rotation ?? template.rotation,
  };
}

/**
 * Get recommended match format template for a given team format
 * @param teamFormat - The team format (e.g., '6x6', '4x4', '2x2')
 * @returns The recommended default template for that format
 */
export function getRecommendedMatchFormatTemplate(teamFormat: MatchFormatTemplate['format']): MatchFormatTemplate | undefined {
  // Return the first (primary/recommended) template for each format
  const recommendedIds: Record<MatchFormatTemplate['format'], string> = {
    '6x6': 'indoor-6v6-best-of-3',
    '4x4': 'recreational-4v4-best-of-3',
    '3x3': 'triples-3v3-best-of-3',
    '2x2': 'beach-2v2-best-of-3',
  };

  return getMatchFormatTemplateById(recommendedIds[teamFormat]);
}

/**
 * Validate if a match format template configuration is valid
 * @param template - The template to validate
 * @returns Object with validation result and any error messages
 */
export function validateMatchFormatTemplate(template: Partial<MatchFormatTemplate>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!template.sets_to_win || template.sets_to_win < 1) {
    errors.push("Sets to win must be at least 1");
  }

  if (!template.point_by_set || template.point_by_set < 1) {
    errors.push("Points per set must be at least 1");
  }

  if (!template.point_final_set || template.point_final_set < 1) {
    errors.push("Points for final set must be at least 1");
  }

  if (template.point_final_set && template.point_by_set && template.point_final_set > template.point_by_set) {
    errors.push("Final set points should not exceed regular set points");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
