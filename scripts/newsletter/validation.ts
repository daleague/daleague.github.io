type JsonObject = Record<string, unknown>;

interface PlayerReference {
  name: string;
  nflTeamAbbreviation?: string;
  isRookieForSeason: boolean;
}

const NFL_TEAMS: Array<{ code: string; aliases: string[] }> = [
  { code: "ARI", aliases: ["ARI", "Arizona", "Arizona Cardinals", "Cardinals"] },
  { code: "ATL", aliases: ["ATL", "Atlanta", "Atlanta Falcons", "Falcons"] },
  { code: "BAL", aliases: ["BAL", "Baltimore", "Baltimore Ravens", "Ravens"] },
  { code: "BUF", aliases: ["BUF", "Buffalo", "Buffalo Bills", "Bills"] },
  { code: "CAR", aliases: ["CAR", "Carolina", "Carolina Panthers", "Panthers"] },
  { code: "CHI", aliases: ["CHI", "Chicago", "Chicago Bears", "Bears"] },
  { code: "CIN", aliases: ["CIN", "Cincinnati", "Cincinnati Bengals", "Bengals"] },
  { code: "CLE", aliases: ["CLE", "Cleveland", "Cleveland Browns", "Browns"] },
  { code: "DAL", aliases: ["DAL", "Dallas", "Dallas Cowboys", "Cowboys"] },
  { code: "DEN", aliases: ["DEN", "Denver", "Denver Broncos", "Broncos"] },
  { code: "DET", aliases: ["DET", "Detroit", "Detroit Lions", "Lions"] },
  { code: "GB", aliases: ["GB", "GNB", "Green Bay", "Green Bay Packers", "Packers"] },
  { code: "HOU", aliases: ["HOU", "Houston", "Houston Texans", "Texans"] },
  { code: "IND", aliases: ["IND", "Indianapolis", "Indianapolis Colts", "Colts"] },
  { code: "JAX", aliases: ["JAX", "JAC", "Jax", "Jacksonville", "Jacksonville Jaguars", "Jaguars", "Jags"] },
  { code: "KC", aliases: ["KC", "KAN", "Kansas City", "Kansas City Chiefs", "Chiefs"] },
  { code: "LAC", aliases: ["LAC", "Los Angeles Chargers", "LA Chargers", "Chargers"] },
  { code: "LAR", aliases: ["LAR", "Los Angeles Rams", "LA Rams", "Rams"] },
  { code: "MIA", aliases: ["MIA", "Miami", "Miami Dolphins", "Dolphins"] },
  { code: "MIN", aliases: ["MIN", "Minnesota", "Minnesota Vikings", "Vikings"] },
  { code: "NE", aliases: ["NE", "NWE", "New England", "New England Patriots", "Patriots"] },
  { code: "NO", aliases: ["NO", "NOR", "New Orleans", "New Orleans Saints", "Saints"] },
  { code: "NYG", aliases: ["NYG", "New York Giants", "NY Giants", "Giants"] },
  { code: "NYJ", aliases: ["NYJ", "New York Jets", "NY Jets", "Jets"] },
  { code: "PHI", aliases: ["PHI", "Philadelphia", "Philadelphia Eagles", "Eagles"] },
  { code: "PIT", aliases: ["PIT", "Pittsburgh", "Pittsburgh Steelers", "Steelers"] },
  { code: "SF", aliases: ["SF", "SFO", "San Francisco", "San Francisco 49ers", "49ers", "Niners"] },
  { code: "SEA", aliases: ["SEA", "Seattle", "Seattle Seahawks", "Seahawks"] },
  { code: "TB", aliases: ["TB", "TAM", "Tampa Bay", "Tampa Bay Buccaneers", "Buccaneers", "Bucs"] },
  { code: "TEN", aliases: ["TEN", "Tennessee", "Tennessee Titans", "Titans"] },
  { code: "WAS", aliases: ["WAS", "WSH", "Washington", "Washington Commanders", "Commanders"] },
];

const ROOKIE_DESCRIPTORS = new Set([
  "qb", "rb", "wr", "te", "k", "dst", "quarterback", "running", "back", "running-back",
  "wide", "receiver", "wideout", "tight", "end", "signal-caller", "signal", "caller",
  "passer", "player", "star", "sensation", "phenom", "prospect", "playmaker",
  "defensive", "offensive", "lineman", "tackle", "guard", "center", "linebacker",
  "cornerback", "safety", "defender", "first-year",
]);

function normalize(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

function collectPlayerReferences(value: unknown, found: PlayerReference[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectPlayerReferences(item, found);
    return;
  }
  if (!value || typeof value !== "object") return;

  const object = value as JsonObject;
  if (
    typeof object.name === "string" &&
    ("nflTeamAbbreviation" in object || "nflOpponentAbbreviation" in object)
  ) {
    found.push({
      name: object.name,
      nflTeamAbbreviation:
        typeof object.nflTeamAbbreviation === "string" && object.nflTeamAbbreviation
          ? object.nflTeamAbbreviation
          : undefined,
      isRookieForSeason: object.isRookieForSeason === true,
    });
  }

  for (const child of Object.values(object)) collectPlayerReferences(child, found);
}

function teamAliases(teamAbbreviation: string): string[] {
  const normalizedTeam = normalize(teamAbbreviation);
  const found = NFL_TEAMS.find((team) =>
    normalize(team.code) === normalizedTeam ||
    team.aliases.some((alias) => normalize(alias) === normalizedTeam),
  );
  return [...new Set([teamAbbreviation, ...(found?.aliases ?? [])])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function hasUnsupportedRookieLabel(text: string, playerName: string): boolean {
  const playerPattern = new RegExp(escapeRegExp(playerName), "gi");
  let match: RegExpExecArray | null;
  while ((match = playerPattern.exec(text)) !== null) {
    const before = text.slice(Math.max(0, match.index - 70), match.index);
    const rookieIndex = before.toLowerCase().lastIndexOf("rookie");
    if (rookieIndex >= 0) {
      const preceding = before.slice(0, rookieIndex);
      const between = before
        .slice(rookieIndex + "rookie".length)
        .trim()
        .replace(/[,:;—–-]+/g, " ")
        .trim();
      const tokens = between ? between.split(/\s+/).map((token) => token.toLowerCase()) : [];
      const descriptorLabel =
        tokens.length <= 4 &&
        tokens.every((token) => ROOKIE_DESCRIPTORS.has(token) || /^20\d{2}$/.test(token));
      if (descriptorLabel && !/\bformer\s*$/i.test(preceding)) return true;
    }

    const after = text.slice(match.index + playerName.length, match.index + playerName.length + 48);
    if (
      /^\s*(?:(?:,|—|–)\s*)?(?:(?:is|was|remains|became|stays|continues\s+to\s+be)\s+)?(?:an?\s+)?rookie\b/i.test(after)
    ) {
      return true;
    }
  }
  return false;
}

function ownTeamOpponentClaim(text: string, player: PlayerReference): string | undefined {
  if (!player.nflTeamAbbreviation) return undefined;
  const aliases = teamAliases(player.nflTeamAbbreviation);
  const playerPattern = new RegExp(escapeRegExp(player.name), "gi");
  const opponentPhrase = /\b(?:against|versus|vs\.?|facing)\s+(?:the\s+)?/gi;
  let playerMatch: RegExpExecArray | null;

  while ((playerMatch = playerPattern.exec(text)) !== null) {
    const afterPlayer = text.slice(playerMatch.index + player.name.length, playerMatch.index + player.name.length + 180);
    let phraseMatch: RegExpExecArray | null;
    opponentPhrase.lastIndex = 0;
    while ((phraseMatch = opponentPhrase.exec(afterPlayer)) !== null) {
      const target = afterPlayer.slice(opponentPhrase.lastIndex, opponentPhrase.lastIndex + 55).replace(/^[\s"'(]+/, "");
      for (const alias of aliases) {
        const aliasMatch = new RegExp("^" + escapeRegExp(alias) + "(?=\\b|$)", "i").exec(target);
        if (aliasMatch) {
          return player.name + " is on NFL team " + player.nflTeamAbbreviation + ", but the newsletter describes the player as performing against " + alias + ". The player's NFL team is not their opponent.";
        }
      }
    }
  }
  return undefined;
}

export function validateNewsletterFacts(markdown: string, context: unknown): string[] {
  const collected: PlayerReference[] = [];
  collectPlayerReferences(context, collected);

  const byName = new Map<string, PlayerReference>();
  for (const player of collected) {
    const key = player.name.trim().toLowerCase();
    if (!key) continue;
    const previous = byName.get(key);
    if (!previous) {
      byName.set(key, player);
      continue;
    }
    byName.set(key, {
      name: previous.name,
      nflTeamAbbreviation: previous.nflTeamAbbreviation ?? player.nflTeamAbbreviation,
      isRookieForSeason: previous.isRookieForSeason || player.isRookieForSeason,
    });
  }

  const issues: string[] = [];
  for (const player of byName.values()) {
    if (!player.isRookieForSeason && hasUnsupportedRookieLabel(markdown, player.name)) {
      issues.push(
        "Unsupported rookie label for " + player.name + ": the supplied data does not explicitly confirm this player is a rookie in the current season.",
      );
    }
    const teamIssue = ownTeamOpponentClaim(markdown, player);
    if (teamIssue) issues.push(teamIssue);
  }

  return [...new Set(issues)];
}
