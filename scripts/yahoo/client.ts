import { mkdir, writeFile } from "node:fs/promises";

const API_BASE = "https://fantasysports.yahooapis.com/fantasy/v2";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

export interface YahooRawData {
  fetchedAt: string;
  gameKey: string;
  leagueKey: string;
  metadata: unknown;
  teams: unknown;
  standings: unknown;
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

function firstValue(node: unknown, key: string): string | number | boolean | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const value = firstValue(item, key);
      if (value !== null) return value;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (key in obj && (typeof obj[key] === "string" || typeof obj[key] === "number" || typeof obj[key] === "boolean")) {
    return obj[key] as string | number | boolean;
  }
  for (const value of Object.values(obj)) {
    const found = firstValue(value, key);
    if (found !== null) return found;
  }
  return null;
}

export function recordsWithKey(node: unknown, key: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  if (!node || typeof node !== "object") return result;
  if (Array.isArray(node)) {
    for (const item of node) result.push(...recordsWithKey(item, key));
    return result;
  }
  const obj = node as Record<string, unknown>;
  if (key in obj) result.push(obj);
  for (const value of Object.values(obj)) result.push(...recordsWithKey(value, key));
  return result;
}

export function findObjects(node: unknown, key: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  if (!node || typeof node !== "object") return result;
  if (Array.isArray(node)) {
    for (const item of node) result.push(...findObjects(item, key));
    return result;
  }
  const obj = node as Record<string, unknown>;
  if (key in obj) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) result.push(item as Record<string, unknown>);
      }
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      result.push(value as Record<string, unknown>);
    }
  }
  for (const value of Object.values(obj)) result.push(...findObjects(value, key));
  return result;
}

export function value(node: unknown, key: string): string | number | boolean | null {
  return firstValue(node, key);
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
  const transactions = await yahooJson(accessToken, `/league/${leagueKey}/transactions;count=100`);

  const scoreboards: Record<string, unknown> = {};
  for (let week = 1; week <= currentWeek; week++) {
    scoreboards[String(week)] = await yahooJson(
      accessToken,
      `/league/${leagueKey}/scoreboard;week=${week}`,
    );
  }

  const teamKeys = findObjects(teams, "team_key")
    .map((team) => String(team.team_key ?? ""))
    .filter(Boolean);

  // Keep a roster snapshot for every completed/current week so historical
  // matchup data can explain awards such as Donkey of the Week.
  const rosters: Record<string, unknown> = {};
  for (let week = 1; week <= currentWeek; week++) {
    for (const teamKey of teamKeys) {
      rosters[`${week}|${teamKey}`] = await yahooJson(
        accessToken,
        `/team/${teamKey}/roster;week=${week}`,
      );
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
  console.log(`[fetch:yahoo] fetched ${leagueKey}, week ${currentWeek}, ${teamKeys.length} teams and ${currentWeek * teamKeys.length} weekly roster snapshots`);
  return data;
}

if (process.argv[1]?.endsWith("scripts/yahoo/run.ts")) {
  await fetchYahooData();
}
