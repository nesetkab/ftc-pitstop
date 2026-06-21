import type { Team } from "./team";

export interface Rankings {
  eventid: string;
  teams: RankingTeam[];
}

export interface RankingTeam {
  rank: number;
  teamNum: number;
  teamName: string;
  wins: number;
  ties: number;
  losses: number;
  sortOrder1: number;
}
