import { mkdir, readFile, writeFile } from "node:fs/promises";
import { buildLeagueBundle, type RawData } from "./parse.js";

async function main() {
  const raw = JSON.parse(await readFile(".cache/yahoo/raw.json", "utf8")) as RawData;
  const {
    league,
    teams,
    standings,
    history,
    currentMatchups,
    superlatives,
    superlativeHistory,
    transactions,
    currentRosters,
  } = buildLeagueBundle(raw);

  await mkdir("data/current", { recursive: true });
  await mkdir("data/historical", { recursive: true });
  await writeFile("data/current/league.json", JSON.stringify(league, null, 2));
  await writeFile("data/current/teams.json", JSON.stringify(teams, null, 2));
  await writeFile("data/current/standings.json", JSON.stringify(standings, null, 2));
  await writeFile("data/current/matchups-current.json", JSON.stringify(currentMatchups, null, 2));
  await writeFile("data/current/matchups-history.json", JSON.stringify(history, null, 2));
  await writeFile("data/current/superlatives-current.json", JSON.stringify(superlatives, null, 2));
  await writeFile("data/current/superlatives-history.json", JSON.stringify(superlativeHistory, null, 2));
  await writeFile("data/current/transactions.json", JSON.stringify(transactions, null, 2));
  await writeFile("data/current/rosters.json", JSON.stringify(currentRosters, null, 2));
  await writeFile("data/current/manager-profiles.json", JSON.stringify([], null, 2));

  for (const week of league.completedWeeks) {
    await writeFile(
      `data/historical/${seasonFile(league.season)}-week-${week}.json`,
      JSON.stringify(history.filter((m) => m.week === week), null, 2),
    );
  }

  const sample = currentMatchups[0] ?? history[0];
  const starterCount = sample ? sample.home.players.filter((p) => p.isStarter).length : 0;
  const dropCount = transactions.filter((t) => t.playersDropped.length > 0).length;
  console.log(
    `[generate] wrote real Yahoo data for ${league.name}, week ${league.currentWeek}, ` +
      `${teams.length} teams, ${history.length} matchups, ${standings.filter((s) => s.wins || s.pointsFor).length} standings with W/PF, ` +
      `${superlativeHistory.length} superlatives, ${transactions.length} transactions (${dropCount} with drops), ` +
      `sample score ${sample ? `${sample.home.score}-${sample.away.score}` : "n/a"} with ${starterCount} starters`,
  );
}

function seasonFile(season: number): string {
  return String(season);
}

main().catch((error) => {
  console.error("[generate] failed");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
