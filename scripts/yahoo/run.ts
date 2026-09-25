import { fetchYahooData } from "./client.js";

if (process.env.YAHOO_API_ENABLED !== "true") {
  console.log("[fetch:yahoo] Yahoo API disabled; skipping fetch.");
  process.exit(0);
}

try {
  await fetchYahooData();
} catch (error) {
  console.error("[fetch:yahoo] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
