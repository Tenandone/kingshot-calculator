# Kingshot data conflicts

Checked: 2026-09-18

Only values that agree across multiple references are added to site data. The items below remain uncommitted to the structured data because the references disagree or do not provide enough evidence.

## Generation 8 conquest stats

| Hero | Field | KingshotData.com | Kingshot.net | Decision |
| --- | --- | ---: | ---: | --- |
| Diego | Hero Attack | 6,573 | 6,573 | Matching, but the complete stat block is withheld because other fields conflict. |
| Diego | Hero Defense | 8,568 | 8,567 | Not added. |
| Diego | Hero Health | 128,538 | 128,514 | Not added. |
| Liz | Hero Attack | 8,568 | 8,567 | Not added. |
| Liz | Hero Defense | 8,568 | 8,567 | Not added. |
| Liz | Hero Health | 85,692 | 85,676 | Not added. |
| Luna | Hero Attack | 10,410 | 10,411 | Not added. |
| Luna | Hero Defense | 8,568 | 8,567 | Not added. |
| Luna | Hero Health | 64,268 | 64,256 | Not added. |

Sources:

- https://kingshotdata.com/heroes/generation-8-heroes/
- https://kingshot.net/heroes
- https://kingshot.net/heroes/diego
- https://kingshot.net/heroes/liz
- https://kingshot.net/heroes/luna

The Expedition Attack and Defense value of `+780.62%` agrees between the two references and is included.

## Ironclad War Bear unlock timing

| Source | Reported timing |
| --- | --- |
| Kingshot.net | 430 days |
| KingshotData.com | Around 440 days |
| Kingshot Wiki | Around 450 days |

Sources:

- https://kingshot.net/tr/database/pets
- https://kingshotdata.com/pets/ironclad-war-bear/
- https://kingshotwiki.com/pets/ironclad-war-bear/

The pet identity, Generation 7 classification, Level 100 cap, two-hour duration, and 2.5% to 10% enemy squad Defense reduction agree sufficiently to identify the existing `unknown` entry. The legacy URL and asset names remain unchanged. The timeline uses the approximate Day 440 milestone and explicitly warns that server timing varies; no exact unlock day is stored in shared data.

## Advanced Truegold Research

External pages confirm that later Truegold progression exists, while the checked references do not provide a second matching source for a complete level-by-level cost and prerequisite table. No Advanced Truegold Research numbers were added.

## Generation 8 assets and exclusive gear

The plain character portraits and skill icons published at `kingshotdata.com/icons/` match the unbranded in-game asset format: transparent portraits and 128px skill icons without a site watermark, banner, card frame, or editorial overlay. Local optimized WebP copies are stored under `img/heroes/Diego`, `img/heroes/Liz`, and `img/heroes/Luna`; no external image is hotlinked. Exclusive-gear data and assets remain omitted until the numerical data is independently verified.

## Building data sources

`data/buildings.json` and `data/buildings-calc.json` serve different consumers and cannot be safely merged without changing both schemas and their loaders:

- `data/buildings.json` drives the building catalogue/detail renderer. It contains 13 buildings, localized i18n keys, unlock descriptions, and building-specific `table` or `tables` layouts.
- `data/buildings-calc.json` drives the building calculator. It contains 9 calculator-supported buildings in a flat Korean table format; the main military buildings and Town Center extend through TG10.
- Slugs also differ for existing routes, including `command` versus `commandcenter` and `war-academy` versus `waracademy`.

The two files remain separate in this update. A future consolidation needs a versioned normalized schema plus compatibility mapping for the current list, detail, and calculator loaders.
