# Kingshot Data Gap Report

Verified on 2026-09-18. Counts describe source records or published entity pages, not decorative cards. External prose was not copied; sources were used to compare scope and cross-check facts.

## Inventory

| Category | Current coverage | Detail / language / media | Static SEO status | Gap |
| --- | --- | --- | --- | --- |
| Heroes | 37 heroes through Generation 8 | Data-driven details, ko/en/ja/zh-TW, local images | 148 localized detail URLs plus lists | Later heroes visible externally require generation and field verification |
| Masters | Roman, Pan, Valora | 3 details in four languages, local images | Direct localized HTML and sitemap entries | No verified additional master record |
| Buildings | 13 source records; 13 details per language | Four languages and local images | Direct localized HTML | Calculator covers 9 buildings; source/detail/calculator ranges differ |
| Research | 191 Academy and 92 Advanced War Academy records | Four-language list/detail rendering | 12 localized static URLs | Names and maximum levels published; disputed numeric ladders withheld |
| War Academy | 30 basic T11 researches plus the 92-record advanced index | Shared numeric JSON and localized UI | Four localized `/waracademy/` pages plus Research routes | Full advanced prerequisites and costs remain withheld |
| Alliance Tech | No source-of-truth dataset | None | None | Entire category missing |
| Pets | 14 pets and 5 rarity level structures | 14 details per language and local images | Direct localized HTML | Current compared external pet catalog also has 14 entries |
| Items | 5 cross-verified high-value entities | Four-language list/details | 24 localized static URLs | At least 5 more externally observed entries need field-level verification |
| Hero Gear | 2 top-level gear datasets | Calculator/UI coverage | Calculator route only | No item-level authoritative pages |
| Governor Gear | 58 upgrade steps, 3 materials | Four-language calculator | Static calculator route | Covered for calculator intent; provenance not normalized |
| Charms | 22 upgrade steps, 2 materials | Four-language calculator | Static calculator route | Covered for calculator intent; provenance not normalized |
| Events | 11 cross-verified event records | Data-driven list/details in four languages | 48 static event URLs | External event catalogs are much broader |
| Troops | 66 training/promotion rows | Calculator coverage | Static calculator route | Entity explanations and provenance missing |
| Truegold | TG progression calculators/guides, including TG10 operating scope | Mixed calculator and guide data | Existing localized routes | Full building requirement reconciliation remains open |
| Kingdom Transfer | Localized guide | Four languages | Direct localized HTML | Structured transfer-rule dataset missing |
| Server Timeline | Localized guide and an older normalized database record | Four languages | Direct localized HTML | Dates are approximate and should not become fixed unlock facts |
| Gift Codes | Published data plus isolated candidate/conflict stores | Automated verification workflow and four-language guides | Direct localized HTML | Raw-HTML active-code visibility should be audited separately |
| Calculators | Building, training, pet, Governor Gear, charm, and related tools | Shared data with localized UI | Core calculator routes are static | Competitors offer battle, score, migration, package, and comparison tools |
| Guides | ko 23 HTML files; en/ja/zh-TW 22 each | Four-language core set | Direct localized HTML | One ko-only page and uneven subject depth |
| Database / Charts | 8 legacy normalized records; a smaller subset exposed in UI | Mixed age and coverage | Existing database routes | Needs freshness review before re-exposure |

## External Scope Comparison

| Source | Observed strength | Relevant comparison |
| --- | --- | --- |
| [Kingshot Database](https://kingshotdata.com/) | Broad entity database; 33 event, 14 pet, 10 item, and 8 database/chart entries observed; basic and advanced War Academy sections | Our largest gaps are events, items, and research |
| [Kingshot.net](https://kingshot.net/) | Database-style masters/buildings and gift-code data | Useful corroboration candidate; complete comparable counts were not extractable |
| [Kshot Lab](https://kshot-lab.com/) | Event-cycle, migration, score, package, progress, and building tools | Our calculators lack event/migration planning breadth |
| [Kingshot Calculator](https://kingshotcalculator.com/) | Building, battle, training, gear, shard, pet, and XP calculators | Our battle simulator and hero comparison coverage is missing |
| [Kingshot Guides](https://kingshotguides.com/) | Frequently updated strategy coverage for heroes, events, and research | Useful discovery source; narrative content is not imported |
| [Kingshot Wiki Events](https://kingshotwiki.com/events/) | Broad event catalog and event mechanics | Used as the second source for the seven added records |
| KingshotStat | No usable structured inventory could be extracted during this audit | Held as unassessed, not treated as evidence |

## Already Covered

- Heroes are normalized through Generation 8 with localized list/detail rendering and local media.
- Pets match the 14-entry external catalog checked in this audit.
- Governor Gear, Charms, troops, and buildings have usable calculator-oriented numeric datasets.
- Masters, buildings, pets, guides, transfer, timeline, and gift-code pages already have localized published surfaces.
- `robots.txt` allows normal crawling and points to the sitemap; no crawler-policy change is required.

## Added

- Added `data/events.json` as the event source of truth with 7 records: Hall of Governors, Strongest Governor, Kingdom of Power, Alliance Brawl, Merchant Empire, Champagne Fair, and Hero Roulette.
- Every record stores provenance, verification date, source type, confidence, and entity relationships.
- Added four-language event dictionaries and automatic list/detail generation.
- Added 4 event list URLs and 28 event detail URLs with canonical, hreflang, OG metadata, H1, raw summary, Quick Facts, question-oriented answers, BreadcrumbList, WebPage JSON-LD, related entities, and source verification.
- Added 191 Academy and 92 Advanced War Academy research identities after cross-checking names and maximum levels. Unresolved cost, time, power, prerequisite, and effect ladders are deliberately absent.
- Added a four-language Research section with one index and two branch pages per language.
- Added 5 verified item entities and 24 localized Item Database URLs.
- Added Viking Vengeance, Mystic Trial, Hall of Heroes, and Champion's Way, raising structured event coverage from 7 to 11 records.
- Added Transfer Passes as a verified item entity linked to the existing migration guide; no speculative migration calculator was introduced.

## Candidate

- Remaining items beyond the 5 verified entities require field-level corroboration and image provenance.
- Later heroes Wilson and Guinevere are visible in an external latest-content feed; generation, skills, acquisition, and images require independent verification.
- Alliance Tech has 60 matching names and maximum levels in two catalogs, but numeric costs, prerequisites, and effects lack independent field-level corroboration.
- Event scoring tables remain single-source or event-version-sensitive and are not published as authoritative data.
- Hero Gear already has a 1-200 upgrade dataset; item-level descriptions and provenance still need two-source verification.
- Research cost, time, power, prerequisite, and effect ladders remain candidates because checked sources disagree on aggregate totals.

## Conflict

- Kingdom of Power phase count differs in source presentation. No fixed phase count was stored.
- Champagne Fair duration/recurrence was present in only one checked source. Those fields were omitted.
- Hero Roulette exact duration was not consistent enough to store. The recurring mechanic was retained.
- Advanced War Academy `Truegold Provisions III` is listed at level 99 by one catalog and level 100 by two catalogs; 100 is used with the conflict retained.
- Research aggregate resource, time, and power totals differ between catalogs and were excluded from the public dataset.
- Full details are tracked in `DATA_CONFLICT_REPORT.md`.

## Missing

| Category | External latest / observed scope | Current gap | Priority |
| --- | --- | --- | --- |
| Events | 33 entries on the broadest checked database; a larger wiki catalog | 11 structured records, so at least 22 database entries remain against the counted source | HIGH |
| Academy Research | 191 identities and maximum levels published | Per-level costs, time, power, prerequisites, and effects remain withheld | HIGH |
| Advanced War Academy | 92 identities and maximum levels published | Per-level numeric ladders remain withheld | HIGH |
| Items | 10 entries observed externally | 5 verified entities published; at least 5 observed entities remain | HIGH |
| Alliance Tech | External game-system coverage exists | No dataset or entity pages | HIGH |
| Building/Truegold reconciliation | External max-level and requirement tables exist | Internal building and calculator ranges differ | HIGH |
| Event scoring | Multiple score-focused tools exist | No normalized scoring tables | MEDIUM |
| Hero Gear entities | Detailed gear data exists externally | Only calculator-oriented top-level structures | MEDIUM |
| Migration forecast/pass data | Dedicated external tools exist | Guide only | MEDIUM |
| Max-level tables | External database/chart entry exists | Legacy internal record is not exposed as authoritative | MEDIUM |

## Recommended Next Order

1. Resolve research aggregate and per-level numeric conflicts before adding costs, time, power, prerequisites, or effects.
2. Cross-verify Alliance Tech numeric ladders before creating a public dataset.
3. Expand events and items in small verified batches, preserving field-level conflicts and image provenance.
4. Reconcile the TG8 guide table with the TG10 building calculator before extending guide totals.
5. Add event scoring and migration calculation only after versioned rules and values have two-source verification.
