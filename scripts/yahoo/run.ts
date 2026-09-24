import { fetchYahooData } from "./client.js";

try {
  await fetchYahooData();
} catch (error) {
  console.error("[fetch:yahoo] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
