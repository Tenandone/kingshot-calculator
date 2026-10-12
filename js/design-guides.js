/* UI13 progressive presentation. No content, URL, data, storage or reader-state mutations. */
(function () {
  'use strict';
  if (window.KD_DESIGN_GUIDES) return;
  // Existing classifications from data/ui/guides.json (ks-guides-4b091fca22f7aca6).
  const categories = Object.freeze({
    'fishing-event-guide':'events', hallofgovernors:'events', 'kingdom-of-power-prep':'events',
    'kingshot-bear-reward':'rewards', 'kingshot-bearhunt':'battle', 'kingshot-easter-event-spending-guide':'events',
    'kingshot-f2p-guide':'beginner', 'kingshot-giftcode':'rewards', 'kingshot-ruins-tip':'events',
    'mystic-trial':'battle', 'pirates-treasure-guide':'events', 'server-timeline':'systems',
    'ssr-hero-vs':'battle', transfer:'systems', 'tri-alliance-clash':'battle', truegold:'growth',
    viking:'battle', 'war-academy-t11-guide':'growth', 'waves-voyage-guide':'events'
  });
  const descriptions = {
    ko:['설명 보기','설명 접기'], en:['Show descriptions','Hide descriptions'],
    ja:['説明を表示','説明を閉じる'], 'zh-tw':['顯示說明','收起說明']
  };
  const openDescriptions = new Set();
  let observed, observer, queued = false;
  function route(url) {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return null;
      const match = u.pathname.match(/^\/(ko|en|ja|zh-tw)\/guides\/([^/]+)\.html$/i);
      return match ? {locale:match[1].toLowerCase(), slug:match[2].toLowerCase()} : null;
    } catch (_) { return null; }
  }
  function decorateLinks(root) {
    const select = root.querySelector('#ks-guide-sidebar select');
    const labels = Object.fromEntries([...(select?.options || [])].map(option => [option.value, option.textContent]));
    for (const group of root.querySelectorAll('.ks-guide-list,.ks-guide-overview-links')) {
      [...group.querySelectorAll('a[href]')].forEach((a,index) => {
        const entry = route(a.href), category = entry && categories[entry.slug];
        if (!category) return;
        a.dataset.guideSequence = String(index + 1).padStart(2,'0');
        a.dataset.guideCategoryLabel = labels[category] || '';
      });
    }
  }
  function descriptionControl(root) {
    const links = root.querySelector('.ks-guide-overview-links');
    if (!links || links.previousElementSibling?.matches('[data-guide-descriptions]')) return;
    const lang = location.pathname.split('/')[1].toLowerCase(), words = descriptions[lang] || descriptions.ko;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ks-guide-description-toggle';
    button.dataset.guideDescriptions = '';
    const expanded = openDescriptions.has(lang);
    button.textContent = words[expanded ? 1 : 0];
    button.setAttribute('aria-expanded', String(expanded));
    if (!expanded) links.classList.add('ks-guide-descriptions-closed');
    button.addEventListener('click', () => {
      const closed = links.classList.toggle('ks-guide-descriptions-closed');
      closed ? openDescriptions.delete(lang) : openDescriptions.add(lang);
      button.setAttribute('aria-expanded', String(!closed));
      button.textContent = words[closed ? 0 : 1];
    });
    links.before(button);
  }
  function markInternalCouponNotes(root) {
    // These generated labels share .until with expiry/reward information; match only
    // the exact source-count label, preserving its text and every user-facing condition.
    for (const note of root.querySelectorAll('#couponGrid .card > .until')) {
      if (/^(?:검증 출처|Verified sources|確認元|驗證來源)\s*:\s*\d+$/.test(note.textContent.trim())) {
        note.dataset.guideInternalSourceCount = '';
      } else {
        delete note.dataset.guideInternalSourceCount;
      }
    }
  }
  function enhance() {
    queued = false;
    const root = document.getElementById('ks-guide-reader');
    if (!root) return;
    root.dataset.guideDesignKind = root.querySelector('#couponGrid') ? 'giftcode' : root.classList.contains('ks-guide-index') ? 'index' : 'article';
    decorateLinks(root);
    descriptionControl(root);
    markInternalCouponNotes(root);
    if (observed !== root) {
      observer?.disconnect();
      observed = root;
      observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(enhance);
      });
      observer.observe(root, {subtree:true, childList:true});
    }
  }
  window.KD_DESIGN_GUIDES = Object.freeze({version:'ks-ui13-guides-v1', enhance});
  window.addEventListener('kd:page-ready', enhance);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhance, {once:true});
  else enhance();
})();
