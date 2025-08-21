// lib/api-client.ts
import { ScoutingAnswer, ScoutingQuestion } from "./types/scouting";

const FTC_API_BASE_URL = "https://ftc-api.firstinspires.org/v2.0";
const FTC_API_HEADERS = {
  Authorization: `Basic ${btoa(
    `${process.env.FTC_API_USER}:${process.env.FTC_API_TOKEN}`
  )}`,
};

/**
 * A helper function to handle fetch requests, including error handling.
 * @param url The URL to fetch from.
 * @param options The request options.
 * @returns The JSON response from the API.
 */
async function fetchApi(url: string, options: RequestInit = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`API Error: ${res.status} ${res.statusText}`, errorBody);
      throw new Error(`Failed to fetch from API: ${res.statusText}`);
    }
    // Return an empty object for 204 No Content responses
    if (res.status === 204) {
      return {};
    }
    return await res.json();
  } catch (error) {
    console.error(`Error fetching from ${url}:`, error);
    throw error; // Re-throw to be handled by the caller
  }
}

// ============================================================================
// FTC API Functions
// ============================================================================

const fetchFromFTCApi = (endpoint: string, options: RequestInit = {}) => {
  return fetchApi(`${FTC_API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { ...FTC_API_HEADERS, ...options.headers },
  });
};

export const getFTCSeason = async () => {
  const data = await fetchFromFTCApi("/seasons", {
    next: { revalidate: 3600 }, // Revalidate every hour
  });
  return data.seasons[0].currentSeason;
};

export const getFTCEvents = (season: number) =>
  fetchFromFTCApi(`/${season}/events`);
export const searchFTCEvents = (season: number, query: string) =>
  fetchFromFTCApi(`/${season}/events?teamNumber=${query}`);
export const getUpcomingFTCEvents = () => fetchFromFTCApi("/events/upcoming");
export const getFTCEvent = (season: number, eventCode: string) =>
  fetchFromFTCApi(`/${season}/events/${eventCode}`);
export const getFTCTeams = (season: number, eventCode: string) =>
  fetchFromFTCApi(`/${season}/teams?eventCode=${eventCode}`);
export const getFTCRankings = (season: number, eventCode: string) =>
  fetchFromFTCApi(`/${season}/rankings/${eventCode}`);
export const getFTCMatches = (season: number, eventCode: string) =>
  fetchFromFTCApi(`/${season}/matches/${eventCode}`);
export const getFTCAlliances = (season: number, eventCode: string) =>
  fetchFromFTCApi(`/${season}/alliances/${eventCode}`);
export const getFTCTeamStats = (
  season: number,
  teamNumber: number,
  eventCode: string
) => fetchFromFTCApi(`/${season}/events/${eventCode}/matches/teams/${teamNumber}`);

// ============================================================================
// Scouting API Functions
// ============================================================================

const postToScoutingApi = (endpoint: string, body: any) => {
  return fetchApi(`/api/scouting${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
};

export const createScoutingSession = (
  name: string,
  eventCode: string,
  scoutIds: string[],
  teamNumbers: string[],
  questionIds: string[]
) =>
  postToScoutingApi("/sessions", {
    name,
    eventCode,
    scoutIds,
    teamNumbers,
    questionIds,
  });

export const createScout = (name: string) => postToScoutingApi("/scouts", { name });
export const createTeam = (teamNumber: string) =>
  postToScoutingApi("/teams", { teamNumber });
export const createQuestion = (question: ScoutingQuestion) =>
  postToScoutingApi("/questions", question);
export const submitAnswers = (answers: ScoutingAnswer[]) =>
  postToScoutingApi("/answers", answers);
