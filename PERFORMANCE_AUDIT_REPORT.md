# Performance Audit Report

Audit date: 2026-09-18

## Scope and Method

- Mobile Lighthouse profile, Chrome headless.
- Before: current production pages at `https://kingshotdata.kr` before this change.
- After: the updated repository served as static files with no Vite development client.
- Pages: home, Gift Codes, Heroes, hero detail, Buildings, building calculator, Research, Item, Event, About, Privacy, and Contact.
- Lighthouse results naturally vary between runs. The table records one consistent run per page and does not present a best-of score.

## Summary

| Metric | Before average | After average |
| --- | ---: | ---: |
| Performance | 67.2 | 86.1 |
| Accessibility | 93.6 | 93.7 |
| Best Practices | 80.5 | 80.8 |
| SEO | 100.0 | 100.0 |
| FCP | 1,630 ms | 1,806 ms |
| LCP | 4,782 ms | 4,078 ms |
| CLS | 0.823 | 0.000 |
| TBT | 62 ms | 36 ms |
| Transfer size | 1,687 KiB | 1,042 KiB |

The large improvement comes from eliminating the initial static-to-SPA layout shift and avoiding below-the-fold promotional and hero-strip work until it is near the viewport. FCP is slightly later because the stable SPA view is shown as a unit instead of painting a short static summary and then replacing it.

## Page Results

| Page | Performance before | Performance after | CLS before | CLS after |
| --- | ---: | ---: | ---: | ---: |
| Home | 58 | 85 | 0.808 | 0.000 |
| Gift Codes | 98 | 100 | 0.001 | 0.001 |
| Heroes | 53 | 76 | 0.473 | 0.000 |
| Hero detail | 72 | 79 | 1.014 | 0.000 |
| Buildings | 99 | 98 | 0.000 | 0.000 |
| Calculator | 51 | 82 | 0.847 | 0.000 |
| Research | 72 | 83 | 1.739 | 0.000 |
| Item | 68 | 87 | 1.175 | 0.000 |
| Event | 73 | 82 | 0.892 | 0.000 |
| About | 50 | 86 | 0.962 | 0.000 |
| Privacy | 50 | 87 | 1.152 | 0.000 |
| Contact | 62 | 88 | 0.808 | 0.000 |

The pre-change Contact URL was an SPA fallback rather than a dedicated policy page. Its before/after comparison is therefore directional, not like-for-like content.

## Implemented Optimizations

- Prevented the short raw HTML summary from painting and shifting into a substantially different SPA layout during initial hydration.
- Removed unconditional calculator CSS loading from non-calculator routes.
- Started i18n and route-bundle initialization in parallel.
- Deferred the Naver banner and SSR hero strip until their mount approaches the viewport.
- Reused versioned browser caching for deferred static data and HTML instead of timestamp cache busting.
- Added intrinsic dimensions to category, banner, and hero-strip images.
- Added resized WebP assets for home category cards, the War Academy banner, footer banner, logo, and Masters card.

## Transfer Impact

- Home image payload fell from about 1.34 MiB in the production baseline to about 120 KiB in the updated static test.
- Overall average transfer fell by about 645 KiB (38%).
- Home card source assets now total roughly 33 KiB instead of roughly 575 KiB.
- The optimized logo is about 2.6 KiB instead of 28 KiB.
- The optimized footer banner is about 16 KiB instead of 103 KiB.

## Third-Party Impact

Google Analytics and the existing AdSense connection account for most remaining third-party JavaScript. Lighthouse Best Practices remains at 77 on SPA pages primarily because of third-party cookie and DevTools issues reported for these Google services. The scripts were not removed or duplicated because both integrations must remain intact during AdSense review.

## Remaining Opportunities

- Generate responsive thumbnails for the Heroes listing and 64px skill icons. Current source images are larger than their rendered sizes.
- Consider route-specific CSS only after regression coverage is expanded; the current common styles are relied on by SPA navigation.
- Recheck field Core Web Vitals after the deployment has accumulated real-user data. Lighthouse cannot measure production INP from a lab run.
- GitHub Pages controls response cache headers, so repository code cannot fully tune HTTP cache policy.

## Verification

- All 12 representative pages rendered at 390 x 844 without horizontal overflow.
- Broken images: 0.
- Same-origin failed asset requests: 0.
- Browser page errors: 0.
- Sitemap URLs tested locally: 521/521 returned HTTP 200.
- SEO audit: 0 errors, 0 warnings.
