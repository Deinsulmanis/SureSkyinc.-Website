/* ==========================================================================
   SureSky Inc. / SureSky Homes — site behaviour
   Vanilla JS, no dependencies, no build step.
   ========================================================================== */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------
     Current year in footer
     ------------------------------------------------------------------ */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ------------------------------------------------------------------
     Sticky header shadow
     ------------------------------------------------------------------ */
  var header = document.getElementById('siteHeader');
  if (header) {
    var onScrollHeader = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScrollHeader();
    window.addEventListener('scroll', onScrollHeader, { passive: true });
  }

  /* ------------------------------------------------------------------
     Mobile navigation
     ------------------------------------------------------------------ */
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  function closeNav() {
    if (!navToggle || !navLinks) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  }

  // Anchor the drawer directly beneath the header — its offset changes once
  // the top utility bar has scrolled away.
  function positionDrawer() {
    if (!navLinks || !header || window.innerWidth >= 960) return;
    navLinks.style.top = Math.max(0, header.getBoundingClientRect().bottom) + 'px';
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      if (!open) positionDrawer();
      navToggle.setAttribute('aria-expanded', String(!open));
      navLinks.classList.toggle('is-open', !open);
      document.body.classList.toggle('nav-open', !open);
    });

    // Close after tapping any link inside the drawer
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeNav();
    });

    // Close on resize back to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 960) {
        navLinks.style.top = '';
        closeNav();
      } else {
        positionDrawer();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  /* ------------------------------------------------------------------
     Scroll reveal — staggered within each section
     ------------------------------------------------------------------ */
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (reducedMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      // Stagger siblings that enter together
      var batch = entries.filter(function (en) { return en.isIntersecting; });
      batch.forEach(function (entry, i) {
        var el = entry.target;
        el.style.transitionDelay = Math.min(i * 100, 400) + 'ms';
        el.classList.add('is-visible');
        revealObserver.unobserve(el);
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ------------------------------------------------------------------
     Animated stat counters
     ------------------------------------------------------------------ */
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));

  // The markup ships the FINAL number as its text content, so the correct
  // figure shows even if JS never runs or the observer never fires. The
  // animation only ever counts *up to* that value.
  function runCounter(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;

    if (reducedMotion) { el.textContent = String(target); return; }

    var duration = 1400;
    var start = null;
    el.textContent = '0';

    function frame(ts) {
      if (start === null) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = String(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(runCounter);
    } else {
      var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          counterObserver.unobserve(entry.target);
        });
      }, { threshold: 0.6 });
      counters.forEach(function (el) { counterObserver.observe(el); });
    }
  }

  /* ------------------------------------------------------------------
     Floating "Free Estimate" button
     Sits bottom-LEFT (bottom-right is reserved for the AI chat widget).
     Smooth-scrolls to #estimate and hides itself while that section is
     already on screen.
     ------------------------------------------------------------------ */
  var fab = document.getElementById('fabEstimate');
  var nudge = document.getElementById('estimateNudge');
  var estimateSection = document.getElementById('estimate');

  var NUDGE_DELAY = 7000;
  var NUDGE_KEY = 'suresky.estimateNudge.dismissed';

  function scrollToEstimate() {
    if (!estimateSection) return;
    estimateSection.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start'
    });
    var firstField = estimateSection.querySelector('input, select, textarea');
    if (firstField) {
      window.setTimeout(function () { firstField.focus({ preventScroll: true }); },
        reducedMotion ? 0 : 600);
    }
  }

  if (fab && estimateSection) {
    // Three independent reasons for the button to stay hidden:
    //   1. still in the hero, which carries its own visible CTA
    //   2. #estimate is already on screen
    //   3. the timed nudge is showing — one prompt per corner, never two
    var estimateOnScreen = false;

    function nudgeOpen() {
      return !!nudge && nudge.classList.contains('is-open');
    }

    function syncFab() {
      var pastHero = window.scrollY > window.innerHeight * 0.6;
      fab.classList.toggle('is-hidden', !pastHero || estimateOnScreen || nudgeOpen());
    }

    fab.addEventListener('click', scrollToEstimate);

    /* ---- timed nudge -------------------------------------------------- */
    var nudgeClose = document.getElementById('nudgeClose');
    var nudgeCta = document.getElementById('nudgeCta');

    function readDismissed() {
      try { return sessionStorage.getItem(NUDGE_KEY) === '1'; } catch (e) { return false; }
    }
    function markDismissed() {
      try { sessionStorage.setItem(NUDGE_KEY, '1'); } catch (e) { /* private mode */ }
    }

    function hideNudge() {
      if (!nudge) return;
      nudge.classList.remove('is-open');
      markDismissed();
      window.setTimeout(function () { nudge.hidden = true; }, reducedMotion ? 0 : 320);
      syncFab();
    }

    // Armed by the timer, then shown at the first moment it won't cover
    // anything important. In practice that is immediately — by 7s most
    // visitors have scrolled — but a visitor still sitting in the hero gets
    // it only once they move past it, so it never lands on the hero's own
    // CTA (which is the same reason the floating button waits).
    var nudgeArmed = false;

    function maybeShowNudge() {
      if (!nudge || !nudgeArmed || nudgeOpen()) return;
      if (estimateOnScreen || readDismissed()) return;
      if (window.scrollY <= window.innerHeight * 0.6) return;
      nudge.hidden = false;
      requestAnimationFrame(function () {
        nudge.classList.add('is-open');
        syncFab();
      });
    }

    if (nudge && !readDismissed()) {
      window.setTimeout(function () {
        nudgeArmed = true;
        maybeShowNudge();
      }, NUDGE_DELAY);
    }

    if (nudgeClose) nudgeClose.addEventListener('click', hideNudge);
    if (nudgeCta) nudgeCta.addEventListener('click', function () {
      hideNudge();
      scrollToEstimate();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) { estimateOnScreen = entry.isIntersecting; });
        // Reaching the form makes the prompt redundant
        if (estimateOnScreen && nudgeOpen()) hideNudge();
        syncFab();
      }, { threshold: 0, rootMargin: '0px 0px -25% 0px' }).observe(estimateSection);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nudgeOpen()) hideNudge();
    });

    function onScroll() {
      maybeShowNudge();
      syncFab();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    syncFab();
  }

  /* ------------------------------------------------------------------
     Credential marquee — duplicate track for a seamless -50% loop
     ------------------------------------------------------------------ */
  var credTrack = document.getElementById('credTrack');
  if (credTrack && !reducedMotion) {
    var original = Array.prototype.slice.call(credTrack.children);
    original.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      credTrack.appendChild(clone);
    });
  }

  /* ------------------------------------------------------------------
     Scrollspy — highlight the in-view section in the nav
     ------------------------------------------------------------------ */
  var spyLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav__link[href^="#"]')
  );

  if (spyLinks.length && 'IntersectionObserver' in window) {
    var sections = spyLinks
      .map(function (link) { return document.querySelector(link.getAttribute('href')); })
      .filter(Boolean);

    var spyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        spyLinks.forEach(function (link) {
          link.classList.toggle(
            'is-active',
            link.getAttribute('href') === '#' + entry.target.id
          );
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    sections.forEach(function (section) { spyObserver.observe(section); });
  }

  /* ------------------------------------------------------------------
     Service preset links — prefill the estimate form dropdown
     ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-service-preset]');
    if (!trigger) return;

    var preset = trigger.getAttribute('data-service-preset');
    var select = document.getElementById('f-service');
    var message = document.getElementById('f-message');
    if (!select) return;

    var matched = false;
    Array.prototype.forEach.call(select.options, function (opt) {
      if (opt.text.trim().toLowerCase() === preset.trim().toLowerCase()) {
        select.value = opt.value || opt.text;
        matched = true;
      }
    });

    // Warranty CTAs have no matching option — route them to the warranty topic
    if (!matched && /warranty/i.test(preset)) {
      Array.prototype.forEach.call(select.options, function (opt) {
        if (/warranty question/i.test(opt.text)) select.value = opt.value || opt.text;
      });
      if (message && !message.value) {
        message.value = "I'd like more information about the " + preset.replace(/ package$/i, '') + ' package.';
      }
    }

    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /* ------------------------------------------------------------------
     Form validation helpers, shared by both forms
     ------------------------------------------------------------------ */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PHONE_RE = /^[\d\s()+.\-]{7,}$/;

  function fieldOf(input) {
    return input.closest('.field');
  }

  function setInvalid(input, invalid) {
    var field = fieldOf(input);
    if (!field) return;
    field.setAttribute('data-invalid', invalid ? 'true' : 'false');
    input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
  }

  function validateInput(input) {
    var value = (input.value || '').trim();
    var valid = true;

    if (input.hasAttribute('required') && value === '') {
      valid = false;
    } else if (input.type === 'email' && value !== '') {
      valid = EMAIL_RE.test(value);
    } else if (input.type === 'tel' && value !== '') {
      valid = PHONE_RE.test(value);
    }

    setInvalid(input, !valid);
    return valid;
  }

  // Fields we validate: anything required, plus format checks on email/tel
  function controlsOf(form) {
    return Array.prototype.slice.call(
      form.querySelectorAll('input[required], select[required], textarea[required], input[type="email"], input[type="tel"]')
    );
  }

  // Re-validate a field once the user has started fixing it
  function wireLiveValidation(controls) {
    controls.forEach(function (input) {
      input.addEventListener('blur', function () { validateInput(input); });
      var recheck = function () {
        var field = fieldOf(input);
        if (field && field.getAttribute('data-invalid') === 'true') validateInput(input);
      };
      input.addEventListener('input', recheck);
      input.addEventListener('change', recheck);
    });
  }

  // Returns the first invalid control, or null. Focuses and scrolls to it.
  function firstInvalid(controls) {
    var bad = null;
    controls.forEach(function (input) {
      if (!validateInput(input) && !bad) bad = input;
    });
    if (bad) {
      bad.focus();
      bad.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    }
    return bad;
  }

  function showStatus(form, kind, html) {
    var status = form.querySelector('.form-status');
    if (!status) return null;
    status.classList.remove('form-status--ok', 'form-status--error');
    status.classList.add('is-visible', 'form-status--' + kind);
    var use = status.querySelector('use');
    if (use) use.setAttribute('href', kind === 'ok' ? '#i-check' : '#i-alert');
    var text = status.querySelector('.form-status__text');
    if (text) text.innerHTML = html;
    return status;
  }

  // Read the phone number straight off the page so the error message can
  // never drift from whatever the header actually shows.
  function phoneFallbackHtml() {
    var link = document.querySelector('a[href^="tel:"]');
    if (!link) return '';
    var text = (link.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return ' or call us on <a href="' + link.getAttribute('href') + '">' + text + '</a>';
  }

  /* ------------------------------------------------------------------
     Forms — AJAX submit to the endpoint in [data-endpoint].
     Used by the SureSky Homes estimate form and the SureSky Inc. enquiry
     form, both on Formspree and told apart by their _subject field. The
     visitor never leaves the page: the default is prevented and the
     response is handled here.
     ------------------------------------------------------------------ */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-endpoint]'), function (form) {
    var endpoint = form.getAttribute('data-endpoint');
    var submit = form.querySelector('button[type="submit"]');
    var submitLabel = submit ? submit.textContent : '';
    var controls = controlsOf(form);

    wireLiveValidation(controls);

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot — a bot filled the hidden field. Fail silently.
      var gotcha = form.querySelector('[name="_gotcha"]');
      if (gotcha && gotcha.value !== '') return;

      if (firstInvalid(controls)) return;

      // Replies to the notification email should reach the customer
      var replyto = form.querySelector('[name="_replyto"]');
      var email = form.querySelector('[name="email"]');
      if (replyto && email) replyto.value = (email.value || '').trim();

      var status = form.querySelector('.form-status');
      if (status) status.classList.remove('is-visible');

      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Sending…';
      }

      function succeeded() {
        // Hide the fields, leave only the confirmation
        form.classList.add('is-sent');
        var s = showStatus(form, 'ok',
          '<strong>Thanks! Your estimate request is in.</strong>' +
          'SureSky will be in touch shortly — usually within one business day.');
        if (s) {
          s.focus();
          s.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        }
      }

      function failed(data) {
        var detail = '';
        if (data && data.errors && data.errors.length) {
          detail = ' (' + data.errors.map(function (x) { return x.message; }).join(', ') + ')';
        }
        showStatus(form, 'error',
          '<strong>That didn’t send.</strong>' +
          'Something went wrong at our end' + detail + '. Please try again' +
          phoneFallbackHtml() + '.');
        if (submit) {
          submit.disabled = false;
          submit.textContent = submitLabel;
        }
      }

      fetch(endpoint, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      }).then(function (res) {
        // Formspree returns JSON; tolerate an empty body either way
        return res.json()
          .catch(function () { return {}; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      }).then(
        function (r) { if (r.ok) { succeeded(); } else { failed(r.data); } },
        function () { failed(null); }   // network/CORS failure
      );
    });
  });

})();
