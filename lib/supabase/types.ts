import { MergeDeep } from "type-fest";
import { Database as DatabaseGenerated } from "./database.types";
import { PlayerPosition, PlayerRole } from "../enums";
export type { Json } from "./database.types";

// export type Database = DatabaseGenerated;

// Override the type for a specific column in a view:
export type Database = MergeDeep<
  DatabaseGenerated,
  {
    public: {
      Tables: {
        matches: {
          Row: {
            status: "upcoming" | "live" | "completed";
          };
        };
        player_stats: {
          Row: {
            position: "p1" | "p2" | "p3" | "p4" | "p5" | "p6";
            stat_type: "serve" | "spike" | "block" | "reception" | "defense";
            result: "success" | "error" | "good" | "bad";
          };
        };
        score_points: {
          Row: {
            point_type:
              | "serve"
              | "spike"
              | "block"
              | "reception"
              | "defense"
              | "unknown";

            result: "success" | "error";

            current_rotation: { [key in PlayerPosition]: string };
          };
        };
        sets: {
          Row: {
            status: "upcoming" | "live" | "completed";
            first_lineup: { [key in PlayerPosition]: string };
            current_lineup: { [key in PlayerPosition]: string };
            player_roles: { [key: string]: PlayerRole };
          };
        };
      };
    };
  }
>;
