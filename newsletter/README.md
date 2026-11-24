# Weekly Newsletter

The newsletter pipeline produces one Markdown newsletter per completed fantasy week.

## Layout

```
newsletter/
  TEMPLATE.md
  README.md
  data/
    week-N.json
  output/
    week-N.md
```

`newsletter/data/week-N.json` is the sanitized input snapshot used for that newsletter. It is intentionally separate from the site's generated `data/current` files so each newsletter can be reproduced or audited.

`newsletter/output/week-N.md` is the published newsletter. The filename is deterministic, so rerunning a week does not create a second newsletter unless `NEWSLETTER_FORCE=true`.

## Weekly flow

The Tuesday workflow will:
1. Fetch the latest Yahoo data.
2. Normalize the data with the existing transform pipeline.
3. Identify the latest completed fantasy week and the current/upcoming week.
4. Build a compact weekly newsletter data package.
5. Read `newsletter/TEMPLATE.md`.
6. Send the prompt and data to the selected AI provider with web search enabled.
7. Save the generated Markdown under `newsletter/output/week-N.md`.
8. Save the exact input package under `newsletter/data/week-N.json`.
9. Commit the new files back to `main`.

The same pipeline can be run manually for recovery or editing.

## Prompt and theme

The complete AI prompt lives in [`newsletter/TEMPLATE.md`](./TEMPLATE.md). It contains the editorial rules, output structure, and the active edition's creative theme. The generator reads this file on every run, substitutes the week/date/data placeholders, and sends the rendered Markdown directly to the configured provider.

To change the newsletter's theme for a future edition, edit `newsletter/TEMPLATE.md`. There is intentionally no workflow-dispatch theme input and no `NEWSLETTER_THEME` repository variable; the checked-in Markdown file is the single source of truth.

## Sharing and WhatsApp previews

Share the normal newsletter page URL:

`https://daleague.github.io/#/newsletter`

During deployment, the workflow derives the latest newsletter's title and description and injects Open Graph and Twitter preview metadata into the root `index.html` before the Vite build. This is necessary because the site uses React Router's `HashRouter`: URL fragments (the part after `#`) are not sent to GitHub Pages, so WhatsApp's crawler receives the root HTML rather than the rendered React newsletter.

The older `https://daleague.github.io/newsletter-share/` URL remains available as a compatibility redirect, but it is no longer needed for new shares. Because GitHub Pages serves one root HTML document for all hash routes, the root preview metadata describes the latest newsletter even when another client-side route is shared.

## Providers

The generator is designed around a provider switch:
- `NEWSLETTER_PROVIDER=openai`
- `NEWSLETTER_PROVIDER=gemini`
- `NEWSLETTER_PROVIDER=groq`

Credentials stay in GitHub Actions secrets:
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`

The model is selected with the repository variable `NEWSLETTER_MODEL`. Gemini keeps
its same-provider fallback through `NEWSLETTER_FALLBACK_MODEL`. If both Gemini
models are unavailable or rate-limited, the workflow tries Groq's independent API
with `openai/gpt-oss-20b`. Add a `GROQ_API_KEY` GitHub Actions secret from a Groq
account to activate that backup; without it the workflow logs that the backup was
unavailable and preserves the original failure.

OpenAI's Responses API supports a built-in web-search tool, while Gemini supports Google Search grounding and returns grounding/citation metadata. This makes the AI layer replaceable without changing the newsletter data contract or template.

## Activation

The scheduled workflow is gated by the repository variable:

`NEWSLETTER_ENABLED=true`

Until that variable is enabled, the workflow exits successfully without generating a newsletter.

## Schedule

The workflow retries during the Tuesday 5:00 a.m. Central hour (5:07, 5:27, and
5:47 a.m.) using GitHub Actions' timezone-aware schedule. The `America/Chicago`
timezone keeps the local time aligned through daylight-saving changes, and choosing
off-hour minutes avoids GitHub's top-of-hour scheduling congestion. The generator
is idempotent: once the week's newsletter is present, later retries skip the model
call.

