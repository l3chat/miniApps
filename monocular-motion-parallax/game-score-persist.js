const status = document.getElementById('gameStatus');

if (status) {
  let hasBeenShown = !status.hidden;

  const observer = new MutationObserver(() => {
    if (!status.hidden) {
      hasBeenShown = true;
      return;
    }

    // After the score has appeared once, keep it visible when a game ends.
    // The next game will reset the score value itself, but the indicator stays on screen.
    if (hasBeenShown) status.hidden = false;
  });

  observer.observe(status, {
    attributes: true,
    attributeFilter: ['hidden']
  });
}
