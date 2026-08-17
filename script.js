/* =====================================================================
   I Am Human Foundation: interactions
   Small, dependency-free modules. Each guards its own DOM.
   ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Toast ---------- */
  var toastEl = document.getElementById('toast');
  var toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2600);
  }

  /* ---------- Theme ---------- */
  (function themeModule() {
    var toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    var meta = document.querySelector('meta[name="theme-color"]');
    var stored = null;
    try { stored = localStorage.getItem('iah-theme'); } catch (e) {}

    function apply(theme, persist) {
      root.setAttribute('data-theme', theme);
      var isDark = theme === 'dark';
      toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      toggle.setAttribute('aria-label', 'Switch to ' + (isDark ? 'light' : 'dark') + ' theme');
      if (meta) meta.setAttribute('content', isDark ? '#06101E' : '#FBF7F0');
      if (persist) {
        try { localStorage.setItem('iah-theme', theme); } catch (e) {}
      }
    }

    // Bright is the first impression. Dark is only ever an explicit, remembered choice,
    // so a visitor on an OS-wide dark setting still lands on the light palette.
    apply(stored === 'dark' ? 'dark' : 'light', false);

    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next, true);
    });
  })();

  /* ---------- Hero slider ---------- */
  (function heroSliderModule() {
    var track = document.getElementById('heroSlides');
    var ui = document.getElementById('heroControls');
    if (!track || !ui) return;

    var slides = Array.prototype.slice.call(track.querySelectorAll('.hero__slide'));
    var dots = Array.prototype.slice.call(ui.querySelectorAll('[data-hero-go]'));
    var current = ui.querySelector('[data-hero-current]');
    var total = ui.querySelector('[data-hero-total]');
    var prevBtn = ui.querySelector('[data-hero-prev]');
    var nextBtn = ui.querySelector('[data-hero-next]');
    if (slides.length < 2) return;

    var INTERVAL = 6000;
    var index = 0;
    var timer = null;
    var holds = 0; // hover, focus and hidden-tab holds stack

    ui.style.setProperty('--hero-interval', (INTERVAL / 1000) + 's');
    if (total) total.textContent = String(slides.length);

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === index);
      });
      dots.forEach(function (dot, i) {
        var on = i === index;
        dot.classList.toggle('is-active', on);
        if (on) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      if (current) current.textContent = String(index + 1);
    }

    function go(next) {
      show(next);
      restart(); // a manual move gives the new slide a full turn on screen
    }

    function restart() {
      stop();
      if (reduceMotion.matches || holds > 0) return;
      timer = setInterval(function () { show(index + 1); }, INTERVAL);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function hold(on) {
      holds = Math.max(0, holds + (on ? 1 : -1));
      ui.classList.toggle('is-paused', holds > 0);
      if (holds > 0) stop();
      else restart();
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        go(parseInt(dot.getAttribute('data-hero-go'), 10) || 0);
      });
    });
    if (prevBtn) prevBtn.addEventListener('click', function () { go(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { go(index + 1); });

    // Arrow keys work whenever focus is somewhere in the slider controls.
    ui.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
    });

    var hero = ui.closest('.hero') || ui;
    // Only the controls pause on hover: the hero fills the viewport, so pausing on
    // the whole section would stall the slider whenever the cursor simply rests there.
    ui.addEventListener('mouseenter', function () { hold(true); });
    ui.addEventListener('mouseleave', function () { hold(false); });
    ui.addEventListener('focusin', function () { hold(true); });
    ui.addEventListener('focusout', function () { hold(false); });
    document.addEventListener('visibilitychange', function () { hold(document.hidden); });

    // Swipe, with a threshold that ignores vertical scrolling.
    var startX = 0, startY = 0, tracking = false;
    hero.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    hero.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      go(dx < 0 ? index + 1 : index - 1);
    }, { passive: true });

    if (reduceMotion.matches) ui.classList.add('is-static');
    var onMotionChange = function () {
      ui.classList.toggle('is-static', reduceMotion.matches);
      restart();
    };
    if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onMotionChange);
    else if (reduceMotion.addListener) reduceMotion.addListener(onMotionChange);

    show(0);
    restart();
  })();

  /* ---------- Generic fading sliders (event card, etc.) ---------- */
  (function sliderModule() {
    var sliders = document.querySelectorAll('[data-slider]');
    if (!sliders.length) return;

    Array.prototype.forEach.call(sliders, function (slider) {
      var slides = Array.prototype.slice.call(slider.querySelectorAll('[data-slider-slide]'));
      var dots = Array.prototype.slice.call(slider.querySelectorAll('[data-slider-go]'));
      if (slides.length < 2) return;

      var interval = parseInt(slider.getAttribute('data-slider-interval'), 10) || 5000;
      var index = 0;
      var timer = null;

      function show(next) {
        index = (next + slides.length) % slides.length;
        slides.forEach(function (slide, i) { slide.classList.toggle('is-active', i === index); });
        dots.forEach(function (dot, i) {
          var on = i === index;
          dot.classList.toggle('is-active', on);
          if (on) dot.setAttribute('aria-current', 'true');
          else dot.removeAttribute('aria-current');
        });
      }

      function start() {
        stop();
        if (reduceMotion.matches) return;
        timer = setInterval(function () { show(index + 1); }, interval);
      }
      function stop() { if (timer) { clearInterval(timer); timer = null; } }

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          show(parseInt(dot.getAttribute('data-slider-go'), 10) || 0);
          start();
        });
      });

      slider.addEventListener('mouseenter', stop);
      slider.addEventListener('mouseleave', start);
      slider.addEventListener('focusin', stop);
      slider.addEventListener('focusout', start);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
      });

      show(0);
      start();
    });
  })();

  /* ---------- Header state + scroll progress ---------- */
  (function scrollModule() {
    var header = document.getElementById('siteHeader');
    var bar = document.getElementById('scrollBar');
    var floatCta = document.getElementById('floatCta');
    var hero = document.querySelector('.hero');
    var ticking = false;

    function update() {
      var y = window.scrollY || window.pageYOffset;

      if (header) header.classList.toggle('is-stuck', y > 24);

      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var pct = max > 0 ? Math.min(y / max, 1) : 0;
        bar.style.transform = 'scaleX(' + pct + ')';
      }

      if (floatCta) {
        var threshold = hero ? hero.offsetHeight * 0.6 : 500;
        var nearBottom = y + window.innerHeight > document.documentElement.scrollHeight - 160;
        floatCta.classList.toggle('is-visible', y > threshold && !nearBottom);
      }

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    // Deep links (/#donate) land mid-page without firing a scroll event.
    window.addEventListener('load', onScroll);
    window.addEventListener('hashchange', onScroll);
    update();
  })();

  /* ---------- Reveal on scroll ---------- */
  (function revealModule() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -60px 0px', threshold: 0 });

    items.forEach(function (el) { io.observe(el); });

    // Safety net: anything the observer has not reached by load stays visible
    // rather than invisible (deep links, restored scroll positions, print).
    window.addEventListener('load', function () {
      items.forEach(function (el) {
        var box = el.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) el.classList.add('is-in');
      });
    });
  })();

  /* ---------- Current page marker ---------- */
  (function currentPageModule() {
    var page = document.body.getAttribute('data-page');
    if (!page) return;
    // Mirrors the body[data-page] styling in CSS so assistive tech hears it too.
    var groups = {
      home: 'home', about: 'about', mission: 'about', founder: 'about',
      impact: 'work', projects: 'work',
      launch: 'involved', donate: 'involved', contact: 'involved'
    };
    var group = groups[page];
    if (!group) return;
    document.querySelectorAll('.nav__link[data-nav="' + group + '"]').forEach(function (link) {
      link.setAttribute('aria-current', link.getAttribute('data-nav') === page ? 'page' : 'true');
    });
    document.querySelectorAll('.submenu a, .mobile-menu a').forEach(function (a) {
      if (a.getAttribute('data-nav-page') === page) a.setAttribute('aria-current', 'page');
    });
  })();

  /* ---------- Header dropdowns ---------- */
  (function dropdownModule() {
    var items = document.querySelectorAll('.nav__item--has-menu');
    if (!items.length) return;

    items.forEach(function (item) {
      var trigger = item.querySelector('.nav__link');
      var menu = item.querySelector('.submenu');
      if (!trigger || !menu) return;

      // CSS drives the open state via :hover/:focus-within; keep ARIA truthful.
      var sync = function (open) { trigger.setAttribute('aria-expanded', open ? 'true' : 'false'); };
      sync(false);
      trigger.setAttribute('aria-haspopup', 'true');

      item.addEventListener('mouseenter', function () { sync(true); });
      item.addEventListener('mouseleave', function () { sync(false); });
      item.addEventListener('focusin', function () { sync(true); });
      item.addEventListener('focusout', function (e) {
        if (!item.contains(e.relatedTarget)) sync(false);
      });

      // Escape closes the menu and returns focus to its trigger.
      item.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        sync(false);
        trigger.focus();
      });
    });
  })();

  /* ---------- Active section in nav (home page anchors only) ---------- */
  (function navHighlightModule() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav__link'))
      .filter(function (l) { return (l.getAttribute('href') || '').charAt(0) === '#'; });
    if (!links.length || !('IntersectionObserver' in window)) return;

    var map = {};
    var sections = [];
    links.forEach(function (link) {
      var id = (link.getAttribute('href') || '').slice(1);
      var section = id && document.getElementById(id);
      if (section) { map[id] = link; sections.push(section); }
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('is-active'); });
        var active = map[entry.target.id];
        if (active) active.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    sections.forEach(function (s) { io.observe(s); });
  })();

  /* ---------- Mobile menu ---------- */
  (function menuModule() {
    var btn = document.getElementById('menuBtn');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;

    var lastFocused = null;

    function open() {
      lastFocused = document.activeElement;
      menu.hidden = false;
      // Next frame so the transition runs from the hidden state.
      requestAnimationFrame(function () { menu.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Close menu');
      document.body.classList.add('is-locked');
      var first = menu.querySelector('a, button');
      if (first) first.focus();
    }

    function close() {
      menu.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Open menu');
      document.body.classList.remove('is-locked');
      setTimeout(function () { menu.hidden = true; }, 450);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    function isOpen() { return menu.classList.contains('is-open'); }

    btn.addEventListener('click', function () { isOpen() ? close() : open(); });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen()) return;
      close();
    });

    // Keep focus inside the open menu.
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isOpen()) return;
      var focusables = menu.querySelectorAll('a[href], button:not([disabled]), input');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 960 && isOpen()) close();
    });
  })();

  /* ---------- Copy to clipboard (IBAN) ---------- */
  (function copyModule() {
    var buttons = document.querySelectorAll('[data-copy]');
    if (!buttons.length) return;

    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy') || '';

        function done(ok) {
          if (!ok) { toast('Could not copy. Please select the IBAN manually.'); return; }
          btn.classList.add('is-done');
          var label = btn.querySelector('.copy-btn__label');
          var original = label ? label.textContent : '';
          if (label) label.textContent = 'Copied';
          toast('IBAN copied to clipboard');
          setTimeout(function () {
            btn.classList.remove('is-done');
            if (label) label.textContent = original;
          }, 2400);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(legacyCopy(text)); });
        } else {
          done(legacyCopy(text));
        }
      });
    });
  })();

  /* ---------- Newsletter placeholder ---------- */
  (function subscribeModule() {
    var form = document.querySelector('.subscribe');
    var msg = document.getElementById('subMsg');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="email"]');
      var value = input ? input.value.trim() : '';
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

      if (!valid) {
        if (msg) { msg.style.color = 'var(--accent)'; msg.textContent = 'Please enter a valid email address.'; }
        if (input) input.focus();
        return;
      }

      // CMS/ESP INTEGRATION POINT: POST `value` to the newsletter provider here.
      if (msg) { msg.style.color = 'var(--emerald)'; msg.textContent = 'Thank you. We will be in touch soon.'; }
      form.reset();
      toast('Thank you for joining the movement');
    });
  })();

  /* ---------- Contact form (no backend yet) ---------- */
  (function contactFormModule() {
    var form = document.querySelector('form[data-form="contact"]');
    if (!form) return;
    var msg = form.querySelector('.form__msg');

    function say(text, ok) {
      if (!msg) return;
      msg.style.color = ok ? 'var(--emerald)' : 'var(--accent)';
      msg.textContent = text;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.querySelector('#cName');
      var email = form.querySelector('#cEmail');
      var message = form.querySelector('#cMessage');

      if (!name.value.trim()) { say('Please tell us your name.', false); name.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        say('Please enter a valid email address.', false); email.focus(); return;
      }
      if (message.value.trim().length < 10) {
        say('Please add a little more detail to your message.', false); message.focus(); return;
      }

      // BACKEND INTEGRATION POINT: POST these fields to your form handler
      // (Formspree, Netlify Forms, or your own endpoint) and remove the notice below.
      say('Thank you. Your message has been prepared. Connect a form handler to deliver it.', true);
      form.reset();
      toast('Thank you for reaching out');
    });
  })();

  /* ---------- Smooth in-page scrolling (offset for the sticky header) ---------- */
  (function anchorModule() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var id = link.getAttribute('href');
      if (!id || id === '#' || link.hasAttribute('aria-disabled')) return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      var header = document.getElementById('siteHeader');
      var offset = header ? header.offsetHeight + 12 : 0;
      var top = target.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top: top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });

      // Keep the URL and focus in sync for keyboard and screen-reader users.
      if (history.replaceState) history.replaceState(null, '', id);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  })();

  /* ---------- Footer year ---------- */
  (function yearModule() {
    var el = document.getElementById('year');
    if (el) el.textContent = new Date().getFullYear();
  })();
})();
