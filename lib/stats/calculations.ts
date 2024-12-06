import { PlayerStat, Player, Set, ScorePoint } from "@/lib/supabase/types";
import { StatResult, StatType, PlayerPosition } from "@/lib/types";

// Position-based Performance
interface PositionStats {
  pointsScored: number;
  pointsConceded: number;
  attackAttempts: number;
  attackSuccess: number;
  receptionAttempts: number;
  receptionSuccess: number;
}

export function calculatePositionStats(
  stats: PlayerStat[],
  points: ScorePoint[],
  teamId: string
): Record<PlayerPosition, PositionStats> {
  const positionStats: Record<PlayerPosition, PositionStats> = {} as Record<PlayerPosition, PositionStats>;

  // Initialize stats for each position
  Object.values(PlayerPosition).forEach(position => {
    positionStats[position] = {
      pointsScored: 0,
      pointsConceded: 0,
      attackAttempts: 0,
      attackSuccess: 0,
      receptionAttempts: 0,
      receptionSuccess: 0
    };
  });

  // Calculate points scored and conceded per position
  points.forEach(point => {
    const position = Object.entries(point.current_rotation)
      .find(([_, playerId]) => playerId === point.player_id)?.[0] as PlayerPosition;
    
    if (position) {
      if (point.scoring_team_id === teamId) {
        positionStats[position].pointsScored++;
      } else {
        positionStats[position].pointsConceded++;
      }
    }
  });

  // Calculate attack and reception stats
  stats.forEach(stat => {
    const position = stat.position as PlayerPosition;
    
    if (stat.stat_type === StatType.SPIKE) {
      positionStats[position].attackAttempts++;
      if (stat.result === StatResult.SUCCESS) {
        positionStats[position].attackSuccess++;
      }
    }
    
    if (stat.stat_type === StatType.RECEPTION) {
      positionStats[position].receptionAttempts++;
      if (stat.result === StatResult.SUCCESS || stat.result === StatResult.GOOD) {
        positionStats[position].receptionSuccess++;
      }
    }
  });

  return positionStats;
}

// Scoring Patterns Analysis
interface ScoringPattern {
  position: PlayerPosition;
  startPoint: number;
  length: number;
  setNumber: number;
}

export function analyzeScoringPatterns(
  points: ScorePoint[],
  sets: Set[],
  teamId: string
): {
  patterns: ScoringPattern[];
  rotationStats: Record<PlayerPosition, { points: number; sequences: number }>;
} {
  const patterns: ScoringPattern[] = [];
  const rotationStats: Record<PlayerPosition, { points: number; sequences: number }> = 
    Object.values(PlayerPosition).reduce((acc, pos) => ({
      ...acc,
      [pos]: { points: 0, sequences: 0 }
    }), {} as Record<PlayerPosition, { points: number; sequences: number }>);

  let currentSequence = 0;
  let sequenceStart = 0;
  let lastServer: PlayerPosition | null = null;

  points.forEach((point, index) => {
    const serverPosition = Object.entries(point.current_rotation)
      .find(([_, playerId]) => playerId === point.player_id)?.[0] as PlayerPosition;
    
    if (point.scoring_team_id === teamId) {
      if (!lastServer || lastServer === serverPosition) {
        currentSequence++;
      } else {
        if (currentSequence >= 3) {
          const set = sets.find(s => s.id === point.set_id);
          patterns.push({
            position: lastServer,
            startPoint: sequenceStart,
            length: currentSequence,
            setNumber: set?.set_number || 0
          });
        }
        currentSequence = 1;
        sequenceStart = index;
      }
      if (serverPosition) {
        rotationStats[serverPosition].points++;
        if (currentSequence === 1) {
          rotationStats[serverPosition].sequences++;
        }
      }
      lastServer = serverPosition || null;
    } else {
      if (currentSequence >= 3) {
        const set = sets.find(s => s.id === point.set_id);
        if (lastServer) {
          patterns.push({
            position: lastServer,
            startPoint: sequenceStart,
            length: currentSequence,
            setNumber: set?.set_number || 0
          });
        }
      }
      currentSequence = 0;
      lastServer = null;
    }
  });

  return { patterns, rotationStats };
}

// Defensive Analysis
interface DefensiveStats {
  pointsConceded: number;
  consecutiveLosses: number;
  maxConsecutiveLosses: number;
  attackPatterns: Record<PlayerPosition, number>;
}

export function analyzeDefensiveVulnerabilities(
  points: ScorePoint[],
  teamId: string
): Record<PlayerPosition, DefensiveStats> {
  const defensiveStats: Record<PlayerPosition, DefensiveStats> = {} as Record<PlayerPosition, DefensiveStats>;

  // Initialize stats
  Object.values(PlayerPosition).forEach(position => {
    defensiveStats[position] = {
      pointsConceded: 0,
      consecutiveLosses: 0,
      maxConsecutiveLosses: 0,
      attackPatterns: Object.values(PlayerPosition).reduce((acc, pos) => ({
        ...acc,
        [pos]: 0
      }), {} as Record<PlayerPosition, number>)
    };
  });

  let currentLossStreak = 0;
  let lastPosition: PlayerPosition | null = null;

  points.forEach(point => {
    if (point.scoring_team_id !== teamId) {
      currentLossStreak++;
      const defendingPosition = Object.entries(point.current_rotation)
        .find(([_, playerId]) => playerId === point.player_id)?.[0] as PlayerPosition;
      
      if (defendingPosition) {
        defensiveStats[defendingPosition].pointsConceded++;
        defensiveStats[defendingPosition].consecutiveLosses = currentLossStreak;
        defensiveStats[defendingPosition].maxConsecutiveLosses = Math.max(
          defensiveStats[defendingPosition].maxConsecutiveLosses,
          currentLossStreak
        );

        if (lastPosition) {
          defensiveStats[defendingPosition].attackPatterns[lastPosition]++;
        }
      }
      lastPosition = defendingPosition || null;
    } else {
      currentLossStreak = 0;
    }
  });

  return defensiveStats;
}

// Player Exploitation Analysis
interface PlayerExploitationStats {
  spikeAttempts: number;
  spikeSuccess: number;
  receivingTargets: number;
  blockSuccess: number;
  blockAttempts: number;
}

export function analyzePlayerExploitation(
  stats: PlayerStat[],
  points: ScorePoint[],
  players: Player[]
): Record<string, PlayerExploitationStats> {
  const exploitationStats: Record<string, PlayerExploitationStats> = {};

  // Initialize stats for each player
  players.forEach(player => {
    exploitationStats[player.id] = {
      spikeAttempts: 0,
      spikeSuccess: 0,
      receivingTargets: 0,
      blockSuccess: 0,
      blockAttempts: 0
    };
  });

  // Analyze spikes and blocks
  stats.forEach(stat => {
    if (stat.stat_type === StatType.SPIKE) {
      exploitationStats[stat.player_id].spikeAttempts++;
      if (stat.result === StatResult.SUCCESS) {
        exploitationStats[stat.player_id].spikeSuccess++;
      }
    }
    if (stat.stat_type === StatType.BLOCK) {
      exploitationStats[stat.player_id].blockAttempts++;
      if (stat.result === StatResult.SUCCESS) {
        exploitationStats[stat.player_id].blockSuccess++;
      }
    }
  });

  // Analyze receiving targets
  points.forEach(point => {
    if (point.point_type === 'serve' && point.player_id) {
      exploitationStats[point.player_id].receivingTargets++;
    }
  });

  return exploitationStats;
}

// Tactical Insights
export interface TacticalInsights {
  strongestRotation: PlayerPosition;
  weakestRotation: PlayerPosition;
  bestAttackPosition: PlayerPosition;
  mostVulnerablePosition: PlayerPosition;
  recommendations: string[];
}

export function generateTacticalInsights(
  positionStats: Record<PlayerPosition, PositionStats>,
  defensiveStats: Record<PlayerPosition, DefensiveStats>,
  rotationStats: Record<PlayerPosition, { points: number; sequences: number }>
): TacticalInsights {
  // Find strongest and weakest rotations
  const strongestRotation = Object.entries(rotationStats)
    .reduce((prev, [pos, stats]) => 
      stats.points > rotationStats[prev].points ? pos as PlayerPosition : prev
    , PlayerPosition.P1);

  const weakestRotation = Object.entries(rotationStats)
    .reduce((prev, [pos, stats]) => 
      stats.points < rotationStats[prev].points ? pos as PlayerPosition : prev
    , PlayerPosition.P1);

  // Find best attack position
  const bestAttackPosition = Object.entries(positionStats)
    .reduce((prev, [pos, stats]) => 
      (stats.attackSuccess / stats.attackAttempts) > 
      (positionStats[prev].attackSuccess / positionStats[prev].attackAttempts) 
        ? pos as PlayerPosition : prev
    , PlayerPosition.P1);

  // Find most vulnerable position
  const mostVulnerablePosition = Object.entries(defensiveStats)
    .reduce((prev, [pos, stats]) => 
      stats.pointsConceded > defensiveStats[prev].pointsConceded 
        ? pos as PlayerPosition : prev
    , PlayerPosition.P1);

  // Generate recommendations
  const recommendations: string[] = [
    `Prioritize maintaining possession in ${strongestRotation} rotation where the team scores most effectively`,
    `Focus on defensive coverage in ${weakestRotation} rotation to minimize vulnerabilities`,
    `Increase attack frequency through ${bestAttackPosition} position which shows highest efficiency`,
    `Strengthen defensive formation around ${mostVulnerablePosition} position to reduce point concession`
  ];

  return {
    strongestRotation,
    weakestRotation,
    bestAttackPosition,
    mostVulnerablePosition,
    recommendations
  };
}