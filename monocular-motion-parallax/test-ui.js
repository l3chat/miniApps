const testPanel = document.getElementById('testPanel');
const panelToggle = document.getElementById('panelToggle');

let testWasOpen = false;
let controlsWereHiddenBeforeTest = false;

function syncPanels() {
  const testIsOpen = testPanel?.classList.contains('show') ?? false;

  if (testIsOpen && !testWasOpen) {
    controlsWereHiddenBeforeTest = document.body.classList.contains('controlsHidden');
    document.body.classList.add('controlsHidden');
  }

  if (!testIsOpen && testWasOpen) {
    document.body.classList.toggle('controlsHidden', controlsWereHiddenBeforeTest);
  }

  testWasOpen = testIsOpen;
}

if (testPanel) {
  new MutationObserver(syncPanels).observe(testPanel, {
    attributes: true,
    attributeFilter: ['class']
  });
  syncPanels();
}

// While the test is active, keep the main controls minimized.
panelToggle?.addEventListener('click', event => {
  if (testPanel?.classList.contains('show')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.body.classList.add('controlsHidden');
  }
}, true);
