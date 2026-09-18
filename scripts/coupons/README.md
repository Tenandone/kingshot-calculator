# Kingshot coupon automation

`npm run coupons:update` checks each configured source once, validates observations, and updates coupon data only when evidence or status changes.

## Publication rules

- An official Century Games post can verify a code by itself.
- Two independent non-official sources must agree before a code is published.
- A single non-official observation is stored in `data/coupon-candidates.json` and is never rendered by the site.
- Conflicting non-official observations remain candidates and are summarized in `DATA_CONFLICT_REPORT.md`.
- Explicit official information takes precedence over conflicting aggregator status.
- Code comparison is case-insensitive, while the original display casing is preserved.

## Manual records

Set `manualOverride` to `true` on a record in `data/coupons.json` to preserve its display code, status policy, and expiration. Automated runs may append source evidence, but do not replace manually managed fields.

Permanent codes use `until: "permanent"`. Date-based codes use an ISO `expiresAt` or the existing `until: "YYYY-MM-DD"` field.

## Sources and access policy

- Century Games: public WordPress REST endpoint, official Tier 1 source.
- Kingshot.net: public gift-code page JSON-LD, Tier 2 source.
- Kingshot Mastery: public gift-code page JSON-LD and expired table, Tier 2 source.
- Kingshot Wiki: public active-code markup, Tier 2 source.

Each adapter makes one public request per run with an identifying user agent. The configured public pages are allowed by their current robots rules. No login, account data, private API, automated redemption, or browser automation is used.

Official Discord and Facebook are not collected automatically because they do not provide a stable unauthenticated feed suitable for this job. The official redeem service is linked for users but is never called by the monitor.
