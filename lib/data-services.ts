// lib/data-services.ts
import { calculateOPR, calculateTeamOPR } from "./opr-calculator";
import {
  getFTCAlliances,
  getFTCEvent,
  getFTCMatches,
  getFTCRankings,
  getFTCSeason,
  getFTCTeams,
  getFTCTeamStats,
} from "./api-client";

/**
 * Aggregates all necessary event data including details, teams, matches,
 * rankings, alliances, and OPRs.
 * @param eventCode The code for the event.
 * @returns A comprehensive object of event data.
 */
export const getComprehensiveEventData = async (eventCode: string) => {
  try {
    const season = await getFTCSeason();
    const [eventData, teamsData, matchesData, rankingsData, alliancesData] =
      await Promise.all([
        getFTCEvent(season, eventCode),
        getFTCTeams(season, eventCode),
        getFTCMatches(season, eventCode),
        getFTCRankings(season, eventCode),
        getFTCAlliances(season, eventCode),
      ]);

    const oprs = calculateOPR(matchesData, teamsData);

    return {
      event: eventData.events[0],
      teams: teamsData.teams,
      matches: matchesData.matches,
      rankings: rankingsData.rankings,
      alliances: alliancesData.alliances,
      oprs,
    };
  } catch (error) {
    console.error(`Failed to get comprehensive event data for ${eventCode}:`, error);
    // Depending on desired behavior, you could return null or a specific error object
    return null;
  }
};

/**
 * Gathers all statistics for a specific team at a given event.
 * @param teamNumber The team number.
 * @param eventCode The event code.
 * @returns An object containing team stats and OPR data.
 */
export const getTeamStatsForEvent = async (
  teamNumber: number,
  eventCode: string
) => {
  try {
    const season = await getFTCSeason();
    const [teamStatsData, teamsData, matchesData] = await Promise.all([
      getFTCTeamStats(season, teamNumber, eventCode),
      getFTCTeams(season, eventCode),
      getFTCMatches(season, eventCode),
    ]);

    const allOprs = calculateOPR(matchesData, teamsData);
    const teamOpr = calculateTeamOPR(teamNumber, allOprs);

    return {
      stats: teamStatsData.matches,
      oprs: teamOpr,
      allOprs: allOprs.map((o) => o.opr), // For percentile calculations
    };
  } catch (error) {
    console.error(
      `Failed to get team stats for team ${teamNumber} at event ${eventCode}:`,
      error
    );
    return null;
  }
};

/**
 * Generates predictions for upcoming matches based on OPR.
 * @param eventCode The event code.
 * @returns A list of match predictions.
 */
export const getMatchPredictions = async (eventCode: string) => {
  try {
    const season = await getFTCSeason();
    const [matchesData, teamsData] = await Promise.all([
      getFTCMatches(season, eventCode),
      getFTCTeams(season, eventCode),
    ]);

    const oprs = calculateOPR(matchesData, teamsData);
    const upcomingMatches = matchesData.matches.filter(
      (match: any) => !match.scoreRedFinal
    );

    return upcomingMatches.map((match: any) => {
      const redTeams = match.teams.filter((t: any) => t.station.startsWith("Red"));
      const blueTeams = match.teams.filter((t: any) =>
        t.station.startsWith("Blue")
      );

      const getOprSum = (teamNumbers: number[]) =>
        teamNumbers.reduce((sum, teamNumber) => {
          const teamOpr = oprs.find((o) => o.teamNumber === teamNumber);
          return sum + (teamOpr ? teamOpr.opr.total : 0);
        }, 0);

      const redTeamNumbers = redTeams.map((t: any) => t.teamNumber);
      const blueTeamNumbers = blueTeams.map((t: any) => t.teamNumber);

      const redOprSum = getOprSum(redTeamNumbers);
      const blueOprSum = getOprSum(blueTeamNumbers);

      return {
        description: match.description,
        red: {
          teams: redTeamNumbers,
          opr: redOprSum,
        },
        blue: {
          teams: blueTeamNumbers,
          opr: blueOprSum,
        },
      };
    });
  } catch (error) {
    console.error(`Failed to get match predictions for ${eventCode}:`, error);
    return []; // Return an empty array on failure
  }
};
