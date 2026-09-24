import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const clientId = process.env.YAHOO_CLIENT_ID;
const clientSecret = process.env.YAHOO_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Missing YAHOO_CLIENT_ID or YAHOO_CLIENT_SECRET.");
  console.error("Set them only in your local shell; never commit them.");
  process.exit(1);
}

const redirectUri = "oob";
const authUrl = new URL("https://api.login.yahoo.com/oauth2/request_auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("language", "en-us");

console.log("\n1. Open this URL in your browser:\n");
console.log(authUrl.toString());
console.log("\n2. Sign in to the Yahoo account that owns the fantasy league.");
console.log("3. Authorize the application.");
console.log("4. Yahoo will display an authorization code. Copy it here.\n");

const rl = createInterface({ input, output });
const code = (await rl.question("Authorization code: ")).trim();
rl.close();

if (!code) {
  console.error("No authorization code supplied.");
  process.exit(1);
}

const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
const response = await fetch("https://api.login.yahoo.com/oauth2/get_token", {
  method: "POST",
  headers: {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  }),
});

const body = await response.text();

if (!response.ok) {
  console.error(`Yahoo token exchange failed (${response.status}).`);
  console.error(body);
  process.exit(1);
}

const tokens = JSON.parse(body) as {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

if (!tokens.refresh_token) {
  console.error("Yahoo did not return a refresh token.");
  process.exit(1);
}

console.log("\nOAuth authorization succeeded.");
console.log(`Access token lifetime: ${tokens.expires_in ?? "unknown"} seconds`);
console.log("\nREFRESH TOKEN (store this as GitHub Actions secret YAHOO_REFRESH_TOKEN):");
console.log(tokens.refresh_token);
console.log("\nDo not commit or paste this token into source code, issues, or chat.");
