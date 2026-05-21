const SIZE = 5;
const TOTAL = SIZE * SIZE;
const CENTER_INDEX = Math.floor(TOTAL / 2);

const variants = {
  standard: {
    numberCount: TOTAL,
    hasCenterDot: false
  },
  centerDot: {
    numberCount: TOTAL - 1,
    hasCenterDot: true
  }
};

const translations = {
  en: {
    title: "Schulte Table",
    variant: "Variant",
    variantStandard: "1-25",
    variantCenterDot: "1-24 + dot",
    language: "Language",
    time: "Time",
    best: "Best",
    restart: "New table",
    startMessage: "Press Space or tap the table to reveal and start.",
    runningMessage: "Press Space or tap the table again when you are done.",
    completeMessage: "Finished in {time}.",
    tableLabel: "Schulte table",
    centerDotLabel: "Center dot"
  },
  ru: {
    title: "Таблица Шульте",
    variant: "Вариант",
    variantStandard: "1-25",
    variantCenterDot: "1-24 + точка",
    language: "Язык",
    time: "Время",
    best: "Лучшее",
    restart: "Новая таблица",
    startMessage: "Нажмите Пробел или коснитесь таблицы, чтобы открыть числа и начать.",
    runningMessage: "Нажмите Пробел или коснитесь таблицы снова, когда закончите.",
    completeMessage: "Готово за {time}.",
    tableLabel: "Таблица Шульте",
    centerDotLabel: "Точка в центре"
  },
  uk: {
    title: "Таблиця Шульте",
    variant: "Варіант",
    variantStandard: "1-25",
    variantCenterDot: "1-24 + крапка",
    language: "Мова",
    time: "Час",
    best: "Найкращий",
    restart: "Нова таблиця",
    startMessage: "Натисніть Пробіл або торкніться таблиці, щоб відкрити числа й почати.",
    runningMessage: "Натисніть Пробіл або торкніться таблиці ще раз, коли закінчите.",
    completeMessage: "Готово за {time}.",
    tableLabel: "Таблиця Шульте",
    centerDotLabel: "Крапка в центрі"
  },
  de: {
    title: "Schulte-Tabelle",
    variant: "Variante",
    variantStandard: "1-25",
    variantCenterDot: "1-24 + Punkt",
    language: "Sprache",
    time: "Zeit",
    best: "Bestzeit",
    restart: "Neue Tabelle",
    startMessage: "Drücke die Leertaste oder tippe auf die Tabelle, um aufzudecken und zu starten.",
    runningMessage: "Drücke die Leertaste oder tippe erneut auf die Tabelle, wenn du fertig bist.",
    completeMessage: "Fertig in {time}.",
    tableLabel: "Schulte-Tabelle",
    centerDotLabel: "Mittelpunkt"
  },
  fr: {
    title: "Table de Schulte",
    variant: "Variante",
    variantStandard: "1-25",
    variantCenterDot: "1-24 + point",
    language: "Langue",
    time: "Temps",
    best: "Meilleur",
    restart: "Nouvelle table",
    startMessage: "Appuyez sur Espace ou touchez la table pour révéler et démarrer.",
    runningMessage: "Appuyez sur Espace ou touchez encore la table quand vous avez terminé.",
    completeMessage: "Terminé en {time}.",
    tableLabel: "Table de Schulte",
    centerDotLabel: "Point central"
  }
};

const grid = document.querySelector("#schulte-grid");
const timerEl = document.querySelector("#timer");
const bestTimeEl = document.querySelector("#best-time");
const messageEl = document.querySelector("#message");
const restartButton = document.querySelector("#restart-button");
const languageSelect = document.querySelector("#language-select");
const variantSelect = document.querySelector("#variant-select");

let currentLanguage = localStorage.getItem("schulte-language") || detectLanguage();
let currentVariant = localStorage.getItem("schulte-variant") || "standard";
let startTime = 0;
let elapsedBeforeFrame = 0;
let timerFrame = 0;
let running = false;
let finished = false;
let bestMs = getBestMs();

function detectLanguage() {
  const browserLanguage = navigator.language.slice(0, 2).toLowerCase();
  return translations[browserLanguage] ? browserLanguage : "en";
}

function t(key, values = {}) {
  const template = translations[currentLanguage][key] || translations.en[key] || "";
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, value),
    template
  );
}

function setLanguage(language) {
  currentLanguage = translations[language] ? language : "en";
  document.documentElement.lang = currentLanguage;
  localStorage.setItem("schulte-language", currentLanguage);
  languageSelect.value = currentLanguage;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  grid.setAttribute("aria-label", t("tableLabel"));
  grid.querySelectorAll(".center-dot").forEach((cell) => {
    cell.setAttribute("aria-label", t("centerDotLabel"));
  });
  renderBest();
  updateMessage();
}

function setVariant(variant) {
  currentVariant = variants[variant] ? variant : "standard";
  localStorage.setItem("schulte-variant", currentVariant);
  variantSelect.value = currentVariant;
  bestMs = getBestMs();
  resetGame();
  renderBest();
}

function getBestMs() {
  return Number(localStorage.getItem(getBestStorageKey())) || 0;
}

function getBestStorageKey() {
  return `schulte-best-ms-${currentVariant}`;
}

function updateMessage() {
  if (running) {
    messageEl.textContent = t("runningMessage");
  } else if (finished) {
    messageEl.textContent = t("completeMessage", {
      time: formatTime(elapsedBeforeFrame)
    });
  } else {
    messageEl.textContent = t("startMessage");
  }
}

function shuffle(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function createTable() {
  const config = variants[currentVariant];
  const numbers = shuffle(Array.from({ length: config.numberCount }, (_, index) => index + 1));
  let numberIndex = 0;
  grid.innerHTML = "";

  for (let cellIndex = 0; cellIndex < TOTAL; cellIndex += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");

    if (config.hasCenterDot && cellIndex === CENTER_INDEX) {
      cell.classList.add("center-dot");
      cell.textContent = "•";
      cell.setAttribute("aria-label", t("centerDotLabel"));
    } else {
      const number = numbers[numberIndex];
      numberIndex += 1;
      cell.textContent = number;
      cell.setAttribute("aria-label", String(number));
    }

    grid.append(cell);
  }
}

function resetGame() {
  stopTimer();
  elapsedBeforeFrame = 0;
  running = false;
  finished = false;
  timerEl.textContent = formatTime(0);
  grid.classList.add("numbers-hidden");
  createTable();
  updateMessage();
}

function resetTimerOnly() {
  stopTimer();
  elapsedBeforeFrame = 0;
  running = false;
  finished = false;
  timerEl.textContent = formatTime(0);
  grid.classList.add("numbers-hidden");
  updateMessage();
}

function startTimer() {
  if (running || finished) {
    return;
  }

  running = true;
  startTime = performance.now();
  grid.classList.remove("numbers-hidden");
  updateMessage();
  tick();
}

function stopTimer() {
  cancelAnimationFrame(timerFrame);
  timerFrame = 0;
  running = false;
}

function tick() {
  elapsedBeforeFrame = performance.now() - startTime;
  timerEl.textContent = formatTime(elapsedBeforeFrame);
  timerFrame = requestAnimationFrame(tick);
}

function finishGame() {
  if (!running) {
    return;
  }

  stopTimer();
  finished = true;
  timerEl.textContent = formatTime(elapsedBeforeFrame);
  updateMessage();

  if (!bestMs || elapsedBeforeFrame < bestMs) {
    bestMs = elapsedBeforeFrame;
    localStorage.setItem(getBestStorageKey(), String(bestMs));
    renderBest();
  }
}

function toggleRun() {
  if (running) {
    finishGame();
    return;
  }

  if (finished) {
    resetTimerOnly();
  }

  startTimer();
}

function renderBest() {
  bestTimeEl.textContent = bestMs ? formatTime(bestMs) : "--";
}

function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

grid.addEventListener("click", toggleRun);

restartButton.addEventListener("click", () => {
  resetGame();
  grid.focus({ preventScroll: true });
});

languageSelect.addEventListener("change", (event) => {
  setLanguage(event.target.value);
});

variantSelect.addEventListener("change", (event) => {
  setVariant(event.target.value);
  grid.focus({ preventScroll: true });
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTypingControl =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable;

  if (event.code === "Space" && !isTypingControl) {
    event.preventDefault();
    toggleRun();
  }
});

setLanguage(currentLanguage);
setVariant(currentVariant);
