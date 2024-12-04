import { PlayerStat, Player, Set } from "@/lib/supabase/types";
import { PlayerPosition, PlayerRole, StatResult, StatType } from "@/lib/types";

export function calculateMVPScore(stats: PlayerStat[], players: Player[], sets: Set[]) {
  const weights = {
    [StatType.SERVE]: 1,
    [StatType.SPIKE]: 1.2,
    [StatType.BLOCK]: 1.5,
    [StatType.RECEPTION]: 0.8,
  };

  const playerScores = new Map();
  const setMVPs: any[] = [];

  // Calculate scores per set
  sets.forEach((set) => {
    const setStats = stats.filter((stat) => stat.set_id === set.id);
    const setScores = new Map();

    setStats.forEach((stat) => {
      const score = calculateStatScore(stat, weights);
      const currentScore = setScores.get(stat.player_id) || 0;
      setScores.set(stat.player_id, currentScore + score);
    });

    // Find MVP for this set
    let maxScore = 0;
    let mvpId: string | null = null;

    setScores.forEach((score, playerId) => {
      if (score > maxScore) {
        maxScore = score;
        mvpId = playerId;
      }
    });

    if (mvpId) {
      const mvpPlayer = players.find((p) => p.id === mvpId);
      setMVPs.push({
        setId: set.id,
        setNumber: set.set_number,
        player: mvpPlayer!,
        score: maxScore,
      });
    }

    // Add to overall scores
    setScores.forEach((score, playerId) => {
      const currentScore = playerScores.get(playerId) || 0;
      playerScores.set(playerId, currentScore + score);
    });
  });

  // Find match MVP
  let maxScore = 0;
  let matchMVPId: string | null = null;

  playerScores.forEach((score, playerId) => {
    if (score > maxScore) {
      maxScore = score;
      matchMVPId = playerId;
    }
  });

  const matchMVP = {
    player: players.find((p) => p.id === matchMVPId)!,
    score: maxScore,
  };

  return {
    matchMVP,
    setMVPs,
  };
}

function calculateStatScore(stat: PlayerStat, weights: Record<string, number>): number {
  const baseScore = stat.result === StatResult.SUCCESS ? 1 :
                   stat.result === StatResult.ERROR ? -1 :
                   0.5;
  
  return baseScore * (weights[stat.stat_type] || 1);
}