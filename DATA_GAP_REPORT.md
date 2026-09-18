# Kingshot Data Gap Report

Verified on 2026-09-18. Counts describe source records or published entity pages, not decorative cards. External prose was not copied; sources were used to compare scope and cross-check facts.

## Inventory

| Category | Current coverage | Detail / language / media | Static SEO status | Gap |
| --- | --- | --- | --- | --- |
| Heroes | 37 heroes through Generation 8 | Data-driven details, ko/en/ja/zh-TW, local images | 148 localized detail URLs plus lists | Later heroes visible externally require generation and field verification |
| Masters | Roman, Pan, Valora | 3 details in four languages, local images | Direct localized HTML and sitemap entries | No verified additional master record |
| Buildings | 13 source records; 13 details per language | Four languages and local images | Direct localized HTML | Calculator covers 9 buildings; source/detail/calculator ranges differ |
| Research | Strategy/building content only | No normalized Academy research source | No entity detail generator | Development, Economy, and Battle ladders missing |
| War Academy | 30 basic T11 researches: 10 per troop tree | Shared numeric JSON and localized UI | Four localized `/waracademy/` pages | Advanced research and full prerequisites missing |
| Alliance Tech | No source-of-truth dataset | None | None | Entire category missing |
| Pets | 14 pets and 5 rarity level structures | 14 details per language and local images | Direct localized HTML | Current compared external pet catalog also has 14 entries |
| Items | Calculator material fields only | No item entity database | None | External database exposes 10 item entries |
| Hero Gear | 2 top-level gear datasets | Calculator/UI coverage | Calculator route only | No item-level authoritative pages |
| Governor Gear | 58 upgrade steps, 3 materials | Four-language calculator | Static calculator route | Covered for calculator intent; provenance not normalized |
| Charms | 22 upgrade steps, 2 materials | Four-language calculator | Static calculator route | Covered for calculator intent; provenance not normalized |
| Events | 7 cross-verified event records added in this change | Data-driven list/details in four languages | 32 new static URLs | External event catalogs are much broader |
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

## Candidate

- Advanced War Academy: an external source shows 92 advanced researches, but a second numeric source was not established.
- Items: 10 external item entries were observed, but per-item fields and media were not cross-verified.
- Later heroes Wilson and Guinevere are visible in an external latest-content feed; generation, skills, acquisition, and images require independent verification.
- Additional events such as Viking Vengeance, Mystic Trial, Champion's Way, and Hall of Heroes require two-source field-level verification before source records are created.
- Academy and Alliance research trees need official or second-source numeric tables before implementation.

## Conflict

- Kingdom of Power phase count differs in source presentation. No fixed phase count was stored.
- Champagne Fair duration/recurrence was present in only one checked source. Those fields were omitted.
- Hero Roulette exact duration was not consistent enough to store. The recurring mechanic was retained.
- Full details are tracked in `DATA_CONFLICT_REPORT.md`.

## Missing

| Category | External latest / observed scope | Current gap | Priority |
| --- | --- | --- | --- |
| Events | 33 entries on the broadest checked database; a larger wiki catalog | 7 structured records, so at least 26 database entries remain against the counted source | HIGH |
| Academy Research | Full Development/Economy/Battle trees exist externally | No normalized records | HIGH |
| Advanced War Academy | 92 researches advertised externally | No verified advanced records | HIGH |
| Items | 10 entries observed externally | No normalized item entities | HIGH |
| Alliance Tech | External game-system coverage exists | No dataset or entity pages | HIGH |
| Building/Truegold reconciliation | External max-level and requirement tables exist | Internal building and calculator ranges differ | HIGH |
| Event scoring | Multiple score-focused tools exist | No normalized scoring tables | MEDIUM |
| Hero Gear entities | Detailed gear data exists externally | Only calculator-oriented top-level structures | MEDIUM |
| Migration forecast/pass data | Dedicated external tools exist | Guide only | MEDIUM |
| Max-level tables | External database/chart entry exists | Legacy internal record is not exposed as authoritative | MEDIUM |

## Recommended Next Order

1. Cross-verify Academy and advanced War Academy numeric ladders against a second independent source.
2. Expand events in small verified batches, preserving field-level conflicts.
3. Create an item source schema only after item identity, acquisition, and image provenance are verified.
4. Reconcile building source, calculator, Truegold, and max-level ranges without overwriting conflicts.
5. Normalize Alliance Tech, then add scoring and migration tools from verified source data.
