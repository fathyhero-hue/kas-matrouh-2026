export type StatsTable = "goals" | "cards";

export type StatsPlayerSelection = {
  roster_player_id: string;
  team_roster_id: string;
  // Display hints only. The server resolves and stores the authoritative snapshots.
  player_name: string;
  team_name: string;
};

export type GoalCreatePayload = StatsPlayerSelection & {
  table: "goals";
  bracket_id: string;
  goals: number;
  image_url?: string;
};

export type CardCreatePayload = StatsPlayerSelection & {
  table: "cards";
  bracket_id: string;
  yellow: number;
  red: number;
};

export type StatsIdentityColumns = {
  roster_player_id: string | null;
  team_roster_id: string | null;
  player: string | null;
  team: string | null;
};

export type StatsPlayerRow = StatsIdentityColumns & {
  id: string;
};
