import { Match, Set, PlayerStat, Substitution, ScorePoint } from "@/lib/types";
import { Score } from "../enums";

export interface Command {
  execute(): Promise<MatchState>;
  undo(): Promise<MatchState>;
}

export interface MatchState {
  match: Match | null;
  currentSet: Set | null;
  setPoints: ScorePoint[];
  points: ScorePoint[];
  sets: Set[];
  setStats: PlayerStat[];
  stats: PlayerStat[];
  score: Score;
}

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize: number = 50;

  async executeCommand(command: Command): Promise<MatchState> {
    try {
      const state = await command.execute();
      this.undoStack.push(command);
      this.redoStack = []; // Clear redo stack after new command

      // Maintain max size
      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift();
      }
      return state;
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    }
  }

  async undo(): Promise<MatchState> {
    const command = this.undoStack.pop();
    if (!command) throw new Error("No command to undo");

    try {
      const state = await command.undo();
      this.redoStack.push(command);
      return state;
    } catch (error) {
      console.error('Undo operation failed:', error);
      this.undoStack.push(command); // Restore command to stack
      throw error;
    }
  }

  async redo(): Promise<MatchState> {
    const command = this.redoStack.pop();
    if (!command) throw new Error("No command to redo");

    try {
      const state = await command.execute();

      this.undoStack.push(command);
      return state;
    } catch (error) {
      console.error('Redo operation failed:', error);
      this.redoStack.push(command); // Restore command to stack
      throw error;
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}