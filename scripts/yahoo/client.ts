import { mkdir, writeFile } from "node:fs/promises";
import { hasResolvableTotal, recordsWithKey, value } from "./yahooJson.js";

export { findObjects, recordsWithKey, value } from "./yahooJson.js";

const API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

export interface YahooRawData {
  fetchedAt: string;
  gameKey: string;
  leagueKey: string;
  metadata: unknown;
  teams: unknown;
  standings: unknown;
  settings?: unknown;
  scoreboards: Record<string, unknown>;
  rosters: Record<string, unknown>;
  transactions: unknown;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function getAccessToken(): Promise<string> {
  const clientId = required("YAHOO_CLIENT_ID");
  const clientSecret = required("YAHOO_CLIENT_SECRET");
  const refreshToken = required("YAHOO_REFRESH_TOKEN");

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      redirect_uri: "oob",
      refresh_token: refreshToken,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Yahoo token refresh failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const body = JSON.parse(text) as { access_token?: string };
  if (!body.access_token) throw new Error("Yahoo token response did not contain access_token.");
  return body.access_token;
}

async function yahooJson(accessToken: string, path: string): Promise<unknown> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${API_BASE}${path}${separator}format=json`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Yahoo API ${response.status} for ${path}: ${body.slice(0, 700)}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Yahoo returned non-JSON data for ${path}: ${body.slice(0, 300)}`);
  }
}

async function yahooJsonFallback(accessToken: string, paths: string[]): Promise<unknown> {
  let lastError: Error | undefined;
  for (const path of paths) {
    try {
      return await yahooJson(accessToken, path);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error("Yahoo request failed");
}

export async function fetchYahooData(): Promise<YahooRawData> {
  if (process.env.YAHOO_API_ENABLED !== "true") {
    console.log("[fetch:yahoo] Yahoo API disabled (set YAHOO_API_ENABLED=true to enable it).");
    throw new Error("Yahoo API is disabled by YAHOO_API_ENABLED.");
  }

  const season = required("YAHOO_SEASON");
  const gameCode = process.env.YAHOO_GAME_ID || "nfl";
  const configuredLeague = required("YAHOO_LEAGUE_ID");
  const accessToken = await getAccessToken();

  let leagueKey = configuredLeague;
  let gameKey = gameCode;
  if (!configuredLeague.includes(".l.")) {
    const games = await yahooJson(accessToken, `/games;game_codes=${encodeURIComponent(gameCode)};seasons=${encodeURIComponent(season)}`);
    gameKey = String(value(games, "game_key") || value(games, "game_id") || gameCode);
    leagueKey = `${gameKey}.l.${configuredLeague}`;
  } else {
    gameKey = configuredLeague.split(".l.")[0];
  }

  const metadata = await yahooJson(accessToken, `/league/${leagueKey}/metadata`);
  const currentWeek = Number(value(metadata, "current_week") || 1);
  const teams = await yahooJson(accessToken, `/league/${leagueKey}/teams`);
  const standings = await yahooJson(accessToken, `/league/${leagueKey}/standings`);
  let settings: unknown = null;
  try {
    settings = await yahooJson(accessToken, `/league/${leagueKey}/settings`);
  } catch (error) {
    console.warn(
      `[fetch:yahoo] league settings unavailable; playoff-status derivation will be skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const transactions = await yahooJson(accessToken, `/league/${leagueKey}/transactions;count=250`);

  const scoreboards: Record<string, unknown> = {};
  for (let week = 1; week <= currentWeek; week++) {
    scoreboards[String(week)] = await yahooJson(
      accessToken,
      `/league/${leagueKey}/scoreboard;week=${week}`,
    );
  }

  const teamKeys = recordsWithKey(teams, "team_key")
    .map((team) => String(team.team_key ?? ""))
    .filter((teamKey, index, all) => teamKey && all.indexOf(teamKey) === index);

  const rosters: Record<string, unknown> = {};
  for (let week = 1; week <= currentWeek; week++) {
    let usedFallback = false;
    try {
      const bulk = await yahooJson(
        accessToken,
        `/league/${leagueKey}/teams/roster;week=${week}/players/stats;type=week;week=${week}`,
      );
      // Yahoo can return HTTP 200 here with every player present but the
      // `stats` sub-resource silently missing (a known quirk when it's
      // chained three levels deep across the `teams` collection). That looks
      // like a successful fetch, so a try/catch around the request alone
      // won't catch it — check that at least one player actually has a
      // resolvable player_points total before trusting this response.
      const players = recordsWithKey(bulk, "player_key");
      const pointsCameThrough = players.length > 0 && players.some((p) => hasResolvableTotal(p, "player_points"));
      if (!pointsCameThrough) {
        throw new Error(
          `Bulk roster fetch for week ${week} returned ${players.length} players with no resolvable player_points — falling back to per-team requests.`,
        );
      }
      rosters[`${week}|all`] = bulk;
    } catch (error) {
      usedFallback = true;
      console.warn(`[fetch:yahoo] ${error instanceof Error ? error.message : String(error)}`);
      for (const teamKey of teamKeys) {
        const body = await yahooJsonFallback(accessToken, [
          `/team/${teamKey}/roster;week=${week}/players/stats;type=week;week=${week}`,
          `/team/${teamKey}/roster;week=${week}`,
        ]);
        const players = recordsWithKey(body, "player_key");
        const pointsCameThrough = players.length > 0 && players.some((p) => hasResolvableTotal(p, "player_points"));
        if (!pointsCameThrough) {
          // Every stats-bearing path failed for this team; we still record
          // the roster (slots/names/positions) rather than dropping it, but
          // flag it loudly so a silent zero-points regression is visible in
          // CI logs instead of only showing up as a quiet UI discrepancy.
          console.warn(
            `[fetch:yahoo] Week ${week} team ${teamKey}: roster fetched but no player_points came through in any attempted request. Player points will show as 0 for this team/week.`,
          );
        }
        rosters[`${week}|${teamKey}`] = body;
      }
    }
    if (usedFallback) {
      console.log(`[fetch:yahoo] week ${week}: used per-team roster fallback for ${teamKeys.length} teams.`);
    }
  }

  const data: YahooRawData = {
    fetchedAt: new Date().toISOString(),
    gameKey,
    leagueKey,
    metadata,
    teams,
    standings,
    scoreboards,
    rosters,
    transactions,
  };

  await mkdir(".cache/yahoo", { recursive: true });
  await writeFile(".cache/yahoo/raw.json", JSON.stringify(data), "utf8");
  console.log(`[fetch:yahoo] fetched ${leagueKey}, week ${currentWeek}, ${teamKeys.length} teams and ${currentWeek} weekly roster snapshots`);
  return data;
}

if (process.argv[1]?.endsWith("scripts/yahoo/client.ts")) {
  await fetchYahooData();
}
