import { Command, MatchState } from "./command";
import { Match, Set, PlayerStat, Substitution, ScorePoint } from "@/lib/types";
import { VolleyballDatabase } from "../rxdb/database";
import { PointType, StatResult } from "../enums";

const NORMAL_SET_SCORE = 25;
const TIE_BREAK_SET_SCORE = 15;
const TIE_BREAK_SET_NUMBER = 5;

export class SetSetupCommand implements Command {
  private previousState: MatchState;
  private newState: MatchState;
  private db: VolleyballDatabase;

  constructor(
    previousState: MatchState,
    newSet: Set,
    db: VolleyballDatabase
  ) {
    this.previousState = { ...previousState };
    this.newState = {
      ...previousState,
      set: newSet,
      sets: [...previousState.sets!, newSet],
      score: { home: 0, away: 0 },
      points: [],
      stats: [],
    };
    this.db = db;
  }

  async execute(): Promise<MatchState> {
    await this.db.sets.insert(this.newState.set!);
    return this.newState;
  }

  async undo(): Promise<MatchState> {
    await this.db.sets.findOne(this.newState.set!.id).remove();
    return this.previousState;
  }
}

export class SubstitutionCommand implements Command {
  private previousState: MatchState;
  private newState: MatchState;
  private substitution: Substitution;
  private set: Partial<Set>;
  private db: VolleyballDatabase;

  constructor(
    previousState: MatchState,
    substitution: Substitution,
    db: VolleyballDatabase
  ) {
    this.previousState = { ...previousState };
    this.substitution = substitution;
    this.set = {
      current_lineup: {
        ...previousState.set!.current_lineup,
        [substitution.position]: substitution.player_in_id,
      },
    };
    const newSet = { ...previousState.set!, ...this.set };
    this.newState = {
      ...previousState,
      set: newSet,
      sets: [...previousState.sets!.slice(0, -1), newSet],
    };
    this.db = db;
  }

  async execute(): Promise<MatchState> {
    await this.db.substitutions.insert(this.substitution);
    await this.db.sets.findOne(this.previousState.set!!.id).update({
      $set: {
        ...this.set,
        updated_at: new Date().toISOString(),
      },
    });
    return this.newState;
  }

  async undo(): Promise<MatchState> {
    await this.db.substitutions.findOne(this.substitution.id).remove();
    const oldSet: Partial<Set> = {};
    Object.keys(this.set).forEach((key) => {
      oldSet[key as keyof Set] = this.previousState.set![key as keyof Set] as never;
    });
    console.table(oldSet);
    await this.db.sets.findOne(this.previousState.set!!.id).update({
      $set: { ...oldSet, updated_at: new Date().toISOString(), },
    });
    return this.previousState;
  }
}

export class PlayerStatCommand implements Command {
  private previousState: MatchState;
  private newState: MatchState;
  private stat: PlayerStat;
  private pointCommand?: ScorePointCommand;
  private db: VolleyballDatabase;

  constructor(
    previousState: MatchState,
    stat: PlayerStat,
    db: VolleyballDatabase
  ) {
    this.previousState = { ...previousState };
    this.stat = stat;
    this.newState = {
      ...previousState,
      stats: [...previousState.stats, stat],
    };
    
    if (
      stat.result === StatResult.ERROR ||
      stat.result === StatResult.SUCCESS
    ) {
      const pointType = stat.stat_type as PointType;
      if (Object.values(PointType).includes(pointType)) {
        const isSuccess = stat.result === StatResult.SUCCESS;
        const isError = stat.result === StatResult.ERROR;
        const scoringTeamId = isSuccess ? stat.team_id : (previousState.match!.home_team_id === stat.team_id ? previousState.match!.away_team_id : previousState.match!.home_team_id);
        const newHomeScore = scoringTeamId === previousState.match!.home_team_id ? previousState.score.home + 1 : previousState.score.home;
        const newAwayScore = scoringTeamId === previousState.match!.away_team_id ? previousState.score.away + 1 : previousState.score.away;

        const point: ScorePoint = {
          id: crypto.randomUUID(),
          match_id: stat.match_id,
          set_id: stat.set_id,
          scoring_team_id: scoringTeamId,
          point_type: pointType,
          player_id: stat.player_id,
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          home_score: newHomeScore,
          away_score: newAwayScore,
          current_rotation: previousState.set!.current_lineup,
          player_stat_id: stat.id,
          action_team_id: stat.team_id,
          result: stat.result
        };

        this.pointCommand = new ScorePointCommand(this.newState, point, isSuccess, db);
      }
    }
    this.db = db;
  }

  async execute(): Promise<MatchState> {
    await this.db.player_stats.insert(this.stat);
    if (this.pointCommand) {
      return await this.pointCommand.execute();
    }
    return this.newState;
  }

  async undo(): Promise<MatchState> {
    await this.db.player_stats.findOne(this.stat.id).remove();
    if (this.pointCommand) {
      await this.pointCommand.undo();
    }
    return this.previousState;
  }
}

export class ScorePointCommand implements Command {
  private previousState: MatchState;
  private newState: MatchState;
  private point: ScorePoint;
  private set: Partial<Set>;
  private match: Partial<Match> | null = null;
  private db: VolleyballDatabase;

  constructor(
    previousState: MatchState,
    point: ScorePoint,
    myTeam: boolean,
    db: VolleyballDatabase
  ) {
    this.previousState = { ...previousState };

    this.point = point;
    this.db = db;

    const setNumber = previousState.set!.set_number;
    const {
      home_score: homeScore,
      away_score: awayScore,
      scoring_team_id: scoringTeamId,
    } = point;

    this.set = {
      home_score: homeScore,
      away_score: awayScore,
    };
    if (previousState.set!.server_team_id !== scoringTeamId) {
      this.set.server_team_id = scoringTeamId;
      if (myTeam) {
        let current_lineup = { ...previousState.set!.current_lineup };
        const p1Player = current_lineup.p1;
        current_lineup.p1 = current_lineup.p2;
        current_lineup.p2 = current_lineup.p3;
        current_lineup.p3 = current_lineup.p4;
        current_lineup.p4 = current_lineup.p5;
        current_lineup.p5 = current_lineup.p6;
        current_lineup.p6 = p1Player;
        this.set.current_lineup = current_lineup;
      }
    }

    let setTerminated = false;
    if (
      (setNumber < TIE_BREAK_SET_NUMBER &&
        (homeScore >= NORMAL_SET_SCORE || awayScore >= NORMAL_SET_SCORE) &&
        Math.abs(homeScore - awayScore) >= 2) ||
      (setNumber === TIE_BREAK_SET_NUMBER &&
        (homeScore >= TIE_BREAK_SET_SCORE || awayScore >= TIE_BREAK_SET_SCORE) &&
        Math.abs(homeScore - awayScore) >= 2)
    ) {
      this.set.status = "completed";
      setTerminated = true;
    }
    const newSet = { ...previousState.set!, ...this.set };
    this.newState = {
      ...previousState,
      set: newSet,
      sets: [...previousState.sets!.slice(0, -1), newSet],
      points: [...previousState.points, point],
      score: { home: point.home_score, away: point.away_score },
    };

    if (setTerminated) {
      this.match = {
        home_score:
          homeScore > awayScore
            ? previousState.match!.home_score + 1
            : previousState.match!.home_score,
        away_score:
          awayScore > homeScore
            ? previousState.match!.away_score + 1
            : previousState.match!.away_score,
      };
      if (
        this.match.home_score === 3 ||
        this.match.away_score === 3
      ) {
        this.match.status = "completed";
      }

      this.newState = {
        ...this.newState,
        match: { ...previousState.match!, ...this.match },
      };
    }
  }

  async execute(): Promise<MatchState> {
    await this.db.score_points.insert(this.point);

    await this.db.sets.findOne(this.previousState.set!!.id).update({
      $set: { ...this.set, updated_at: new Date().toISOString(), },
    });

    if (this.match) {
      await this.db.matches.findOne(this.previousState.match!!.id).update({
        $set: { ...this.match, updated_at: new Date().toISOString(), },
      });
    }
    return this.newState;
  }

  async undo(): Promise<MatchState> {
    await this.db.score_points.findOne(this.point.id).remove();
    const oldSet: Partial<Set> = {};
    Object.keys(this.set).forEach((key) => {
      oldSet[key as keyof Set] = this.previousState.set![key as keyof Set] as never;
    });
    await this.db.sets.findOne(this.previousState.set!!.id).update({
      $set: { ...oldSet, updated_at: new Date().toISOString(), },
    });

    if (this.match) {
      const oldMatch: Partial<Match> = {};
      Object.keys(this.match).forEach((key) => {
        oldMatch[key as keyof Match] = this.previousState.match![key as keyof Match] as never;
      });
      await this.db.matches.findOne(this.previousState.match!!.id).update({
        $set: { ...oldMatch, updated_at: new Date().toISOString(), },
      });
    }
    return this.previousState;
  }
}