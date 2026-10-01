/**
 * KC EVENT – MAIN SCRIPT (vanilla, no dependencies)
 */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const cfg = typeof siteConfig !== 'undefined' ? siteConfig : null;
  let lastFocus = null;

  document.addEventListener('DOMContentLoaded', () => {
    bindConfig();
    initTheme();
    initHeader();
    initDrawer();
    initTabs();
    initHashNavigation();
    initGallery();
    initModal();
    initForms();
    initReveal();
  });

  /* ---------- Config binding ---------- */
  function bindConfig() {
    if (!cfg) return;
    const set = (sel, fn) => $$(sel).forEach(fn);
    set('[data-bind="hotline"]', el => { el.textContent = cfg.contact.hotlineDisplay; });
    set('[data-bind="hotline-link"]', el => { el.href = 'tel:' + cfg.contact.hotlineRaw; });
    set('[data-bind="email"]', el => { el.textContent = cfg.contact.email; });
    set('[data-bind="email-link"]', el => { el.href = 'mailto:' + cfg.contact.email; });
    set('[data-bind="address"]', el => { el.textContent = cfg.contact.address; });
    set('[data-bind="tax-code"]', el => { el.textContent = cfg.brand.taxCode; });
    set('[data-bind="legal-name"]', el => { el.textContent = cfg.brand.legalName; });
    set('[data-bind="current-year"]', el => { el.textContent = new Date().getFullYear(); });
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const stored = () => { try { return localStorage.getItem('kc-theme'); } catch (e) { return null; } };
    const apply = (t) => root.setAttribute('data-theme', t);

    $$('.theme-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem('kc-theme', next); } catch (e) { /* storage blocked */ }
      });
    });

    media.addEventListener('change', e => { if (!stored()) apply(e.matches ? 'dark' : 'light'); });
  }

  /* ---------- Header ---------- */
  function initHeader() {
    const header = $('.site-header');
    if (!header) return;
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile drawer ---------- */
  function initDrawer() {
    const drawer = $('#drawer');
    const toggle = $('.menu-toggle');
    const backdrop = $('.backdrop');
    if (!drawer || !toggle) return;

    const open = () => {
      lastFocus = document.activeElement;
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('is-active');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      $('.drawer-close', drawer).focus();
    };
    const close = () => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      backdrop.classList.remove('is-active');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    toggle.addEventListener('click', open);
    $('.drawer-close', drawer).addEventListener('click', close);
    backdrop.addEventListener('click', close);
    $$('a', drawer).forEach(a => a.addEventListener('click', close));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) close(); });
  }

  /* ---------- Tabs (ARIA tablist) ---------- */
  const tabApi = {};

  function initTabs() {
    $$('[data-tabs]').forEach(list => {
      const tabs = $$('[role="tab"]', list);
      const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));

      const select = (tab, focus) => {
        tabs.forEach((t, i) => {
          const on = t === tab;
          t.setAttribute('aria-selected', String(on));
          t.tabIndex = on ? 0 : -1;
          panels[i].hidden = !on;
          if (on) {
            panels[i].classList.remove('is-entering');
            void panels[i].offsetWidth;
            panels[i].classList.add('is-entering');
            $$('.reveal', panels[i]).forEach(el => el.classList.add('is-visible'));
          }
        });
        if (focus) tab.focus();
      };

      tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => {
          select(tab);
          history.replaceState(null, '', '#' + tab.getAttribute('aria-controls'));
        });
        tab.addEventListener('keydown', e => {
          let n = null;
          if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
          if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
          if (e.key === 'Home') n = tabs[0];
          if (e.key === 'End') n = tabs[tabs.length - 1];
          if (n) { e.preventDefault(); select(n, true); }
        });
      });

      panels.forEach(p => { tabApi[p.id] = () => select(tabs[panels.indexOf(p)]); });
      select(tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
    });
  }

  /* Deep links like #thi-cong-gian-hang open the right tab, then scroll to the tab bar. */
  function initHashNavigation() {
    const go = (hash, smooth) => {
      const id = decodeURIComponent((hash || '').slice(1));
      if (!id || !tabApi[id]) return false;
      tabApi[id]();
      const list = document.getElementById(id).parentElement.querySelector('[data-tabs]');
      (list || document.getElementById(id)).scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      return true;
    };

    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (a && go(a.getAttribute('href'), true)) {
        e.preventDefault();
        history.pushState(null, '', a.getAttribute('href'));
      }
    });
    window.addEventListener('hashchange', () => go(location.hash, true));
    if (location.hash) requestAnimationFrame(() => go(location.hash, false));
  }

  /* ---------- Gallery + lightbox ---------- */
  function initGallery() {
    const grid = $('#gallery');
    const moreBtn = $('#gallery-more');
    const lb = $('#lightbox');
    if (!grid || typeof galleryItems === 'undefined') return;

    const PAGE = 8;
    let items = galleryItems.slice();
    let shown = PAGE;
    let index = 0;

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    const render = () => {
      grid.innerHTML = items.slice(0, shown).map((it, i) => `
        <button type="button" class="gallery-item" data-i="${i}" aria-label="Phóng to ảnh: ${esc(it.title)}">
          <img src="${it.src}" srcset="${it.srcset}" sizes="(max-width: 640px) 46vw, (max-width: 960px) 31vw, ${i % 6 === 0 ? '560px' : '280px'}"
               width="${it.width}" height="${it.height}" alt="${esc(it.alt)}" loading="lazy" decoding="async">
          <span class="gallery-cap">${esc(it.title)}<small>${esc(it.client)} · ${esc(it.categoryName)}</small></span>
        </button>`).join('');
      moreBtn.hidden = shown >= items.length;
    };

    $$('[data-filter]').forEach(btn => btn.addEventListener('click', () => {
      $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      const f = btn.dataset.filter;
      items = f === 'all' ? galleryItems.slice() : galleryItems.filter(it => it.category === f);
      shown = PAGE;
      render();
    }));
    moreBtn.addEventListener('click', () => { shown += PAGE; render(); });
    grid.addEventListener('click', e => {
      const b = e.target.closest('.gallery-item');
      if (b) open(Number(b.dataset.i));
    });
    render();

    if (!lb) return;
    const img = $('img', lb);
    const show = () => {
      const it = items[index];
      img.src = it.full;
      img.alt = it.alt;
      $('.lb-title', lb).textContent = it.title;
      $('.lb-meta', lb).textContent = `${it.client} · ${it.location} (${index + 1}/${items.length})`;
    };
    const open = i => {
      lastFocus = document.activeElement;
      index = i;
      show();
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('.lb-close', lb).focus();
    };
    const close = () => {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };
    const step = d => { index = (index + d + items.length) % items.length; show(); };

    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', () => step(-1));
    $('.lb-next', lb).addEventListener('click', () => step(1));
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    let x0 = null;
    lb.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      x0 = null;
    });
  }

  /* ---------- Quote modal ---------- */
  let closeModal = () => {};

  function initModal() {
    const modal = $('#quote-modal');
    if (!modal) return;

    const open = (service) => {
      lastFocus = document.activeElement;
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const sel = $('select[name="service"]', modal);
      if (service && sel) sel.value = service;
      setTimeout(() => { const f = $('input', modal); if (f) f.focus(); }, 60);
    };
    closeModal = () => {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    };

    document.addEventListener('click', e => {
      const t = e.target.closest('[data-open-modal]');
      if (t) { e.preventDefault(); open(t.dataset.service || guessService(t)); }
    });
    $('.modal-close', modal).addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => {
      if (!modal.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Tab') trapFocus(e, $('.modal-dialog', modal));
    });
  }

  // Preselect a service based on which tab panel the CTA lives in.
  function guessService(el) {
    const panel = el.closest('.tab-panel');
    const map = {
      'thiet-ke-2d-3d': 'thiết kế 2D - 3D',
      'thi-cong-gian-hang': 'thi công gian hàng',
      'trang-thiet-bi-su-kien': 'trang thiết bị sự kiện',
      'bieu-dien-nghe-thuat': 'biểu diễn nghệ thuật',
      'dien-tap-tren-bien': 'diễn tập',
      'tour-du-lich': 'tour du lịch doanh nghiệp',
      'team-building': 'team building',
    };
    return panel ? map[panel.id] : '';
  }

  function trapFocus(e, box) {
    const f = $$('a[href], button:not([disabled]), input:not([tabindex="-1"]), select, textarea', box).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Lead forms ---------- */
  function initForms() {
    $$('.lead-form').forEach(form => {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!validate(form)) return;

        const data = Object.fromEntries(new FormData(form).entries());
        if (data.website) return; // honeypot: bots fill hidden field
        delete data.website;
        data.agree = 'yes';
        data.page = location.href;
        data.submittedAt = new Date().toISOString();

        const btn = $('button[type="submit"]', form);
        const label = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Đang gửi...';

        try {
          await sendLead(data);
          form.reset();
          if (form.closest('#quote-modal')) closeModal();
          toast('Gửi yêu cầu thành công!', 'Cảm ơn quý khách. Chuyên viên KC Event sẽ liên hệ trong 15–30 phút.');
        } catch (err) {
          const hot = cfg ? cfg.contact.hotlineDisplay : '0981.941.820';
          toast('Chưa gửi được yêu cầu', 'Vui lòng thử lại hoặc gọi hotline ' + hot + '.', true);
        } finally {
          btn.disabled = false;
          btn.innerHTML = label;
        }
      });

      $$('input, select, textarea', form).forEach(el => {
        el.addEventListener('input', () => clearError(el));
        el.addEventListener('change', () => clearError(el));
      });
    });
  }

  async function sendLead(data) {
    const endpoint = cfg && cfg.leadEndpoint;
    if (endpoint) {
      // Apps Script web apps don't return CORS headers, so post as simple no-cors request.
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
      });
      return;
    }
    // Fallback: open a prefilled email so the lead is never lost.
    const to = cfg ? cfg.contact.email : 'truyenthongsukienkcgroup@gmail.com';
    const body = [
      'Họ tên: ' + data.fullname, 'SĐT: ' + data.phone, 'Email: ' + (data.email || ''),
      'Công ty: ' + data.company, 'Dịch vụ: ' + data.service, 'Số khách: ' + data.guests,
      'Ghi chú: ' + (data.notes || ''),
    ].join('\n');
    window.location.href = `mailto:${to}?subject=${encodeURIComponent('Yêu cầu báo giá – ' + data.company)}&body=${encodeURIComponent(body)}`;
  }

  function validate(form) {
    let ok = true;
    const req = (name, test, msg) => {
      const el = form.elements[name];
      if (!el) return;
      if (!test(el.value.trim())) { showError(el, msg); ok = false; } else clearError(el);
    };
    req('fullname', v => v.length >= 2, 'Vui lòng nhập họ tên (tối thiểu 2 ký tự).');
    req('phone', v => /^(0|\+84)(3|5|7|8|9)\d{8}$/.test(v.replace(/[\s.-]/g, '')), 'Số điện thoại chưa hợp lệ (10 số).');
    req('email', v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Email chưa đúng định dạng.');
    req('company', v => v.length > 0, 'Vui lòng nhập tên công ty / tổ chức.');
    req('service', v => v.length > 0, 'Vui lòng chọn dịch vụ.');

    const agree = form.elements.agree;
    const wrap = agree.closest('.form-check');
    wrap.classList.toggle('is-invalid', !agree.checked);
    if (!agree.checked) ok = false;

    if (!ok) { const bad = $('.is-invalid', form); if (bad && bad.focus) bad.focus(); }
    return ok;
  }

  function showError(el, msg) {
    el.classList.add('is-invalid');
    el.setAttribute('aria-invalid', 'true');
    let err = el.parentElement.querySelector('.form-error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'form-error';
      err.id = el.id + '-error';
      el.parentElement.appendChild(err);
      el.setAttribute('aria-describedby', err.id);
    }
    err.textContent = msg;
  }

  function clearError(el) {
    el.classList.remove('is-invalid');
    el.removeAttribute('aria-invalid');
    const err = el.parentElement && el.parentElement.querySelector('.form-error');
    if (err) err.textContent = '';
  }

  function toast(title, msg, isError) {
    let wrap = $('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status');
      wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' is-error' : '');
    t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${isError
      ? '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'
      : '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'}</svg><div><strong></strong><p></p></div>`;
    $('strong', t).textContent = title;
    $('p', t).textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 5000);
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    // Duplicate marquee items so the CSS loop (-50%) is seamless.
    const track = $('.marquee-track');
    if (track && !track.dataset.cloned) {
      track.dataset.cloned = '1';
      Array.from(track.children).forEach(li => {
        const c = li.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
      });
    }

    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(el => io.observe(el));
  }
})();
