(() => {
  const overlay = document.querySelector('[data-welcome-overlay]');
  const textTarget = overlay?.querySelector('[data-text-type]');
  const cursor = overlay?.querySelector('[data-text-cursor]');
  const SEEN_KEY = 'buffonomicsWelcomeSeen';

  if (!overlay || !textTarget) return;

  const messages = [
    'Welcome to Buffonomics',
    'Stay sharp. Stay informed.',
  ];

  const typingSpeed = 75;
  const deletingSpeed = 40;
  const pauseDuration = 1500;
  const initialDelay = 100;
  const showCursor = true;
  let timeoutId;

  const hideOverlay = () => {
    overlay.classList.add('is-hiding');
    setTimeout(() => {
      overlay.hidden = true;
    }, 400);
  };

  const startBlink = () => {
    if (!cursor) return;
    if (!showCursor) {
      cursor.style.display = 'none';
    }
  };

  const startTyping = () => {
    let sentenceIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const tick = () => {
      const sentence = messages[sentenceIndex] || '';

      if (isDeleting) {
        charIndex = Math.max(0, charIndex - 1);
        textTarget.textContent = sentence.slice(0, charIndex);
        if (charIndex === 0) {
          isDeleting = false;
          sentenceIndex += 1;
          if (sentenceIndex >= messages.length) {
            setTimeout(hideOverlay, pauseDuration);
            return;
          }
          timeoutId = setTimeout(tick, typingSpeed);
          return;
        }
        timeoutId = setTimeout(tick, deletingSpeed);
        return;
      }

      // Typing forward
      if (charIndex < sentence.length) {
        charIndex += 1;
        textTarget.textContent = sentence.slice(0, charIndex);
        timeoutId = setTimeout(tick, typingSpeed);
      } else {
        timeoutId = setTimeout(() => {
          isDeleting = true;
          tick();
        }, pauseDuration);
      }
    };

    timeoutId = setTimeout(tick, initialDelay);
  };

  const init = () => {
    try {
      if (sessionStorage.getItem(SEEN_KEY) === 'true') {
        overlay.hidden = true;
        return;
      }
      sessionStorage.setItem(SEEN_KEY, 'true');
    } catch (err) {
      // ignore storage issues; still attempt to run once
    }

    overlay.hidden = false;
    startBlink();
    startTyping();
    overlay.addEventListener('click', hideOverlay, { once: true });
  };

  document.addEventListener('DOMContentLoaded', init);

  window.addEventListener('beforeunload', () => {
    if (timeoutId) clearTimeout(timeoutId);
  });
})();
