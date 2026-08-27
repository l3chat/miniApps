# Monocular Motion Parallax Lab — Roadmap

Этот файл — основной рабочий план проекта. Он отражает **текущую концепцию и фактический прогресс**, а не историю всех промежуточных идей.

---

# 0. Главная цель

Создать браузерный инструмент, который позволяет:

1. демонстрировать искусственный monocular motion parallax;
2. обучать человека различать глубину одним глазом;
3. количественно измерять качество такого восприятия;
4. сравнивать способы движения виртуальной камеры;
5. подбирать оптимальные параметры под конкретного пользователя;
6. получать воспроизводимые данные для исследовательского анализа.

Главный вопрос:

> **При каких параметрах искусственного временного параллакса конкретный человек лучше всего различает глубину одним глазом?**

---

# 1. Текущая архитектура

Основная задача приложения одна:

> **Найти ближайший объект.**

Она используется в двух режимах:

```text
                    Trial Engine
                         │
             ┌───────────┴───────────┐
             │                       │
          Training               Experiment
             │                       │
     feedback + hints          no feedback
     adaptive training         ranking measurement
     score                     reaction time
     learning                  threshold estimation
```

- **Training** — обучает.
- **Experiment** — измеряет.

Старый отдельный двухобъектный Test удалён из основного UI.

---

# 2. Текущая структура файлов

```text
monocular-motion-parallax/
├── index.html
├── styles.css
├── game.css
├── app.js
├── i18n.js
├── scene.js
├── camera-motion.js
├── trial-engine.js
├── training.js
├── experiment.js
├── storage.js
├── ui.js
├── version.js
├── ROADMAP.md
└── далее:
    ├── stats.js
    └── calibration.js
```

## `scene.js`

- Three.js scene;
- геометрия и материалы;
- 10″ screen grid на расстоянии 30 см;
- Training / Experiment scene generation;
- точное вычисление ближайшей к камере точки поверхности mesh для autofocus;
- освобождение WebGL resources.

## `camera-motion.js`

- Static;
- L↔R;
- 5 viewpoints;
- Continuous;
- baseline;
- frequency;
- waveform;
- manual focus distance;
- dynamic focus override для autofocus.

## `trial-engine.js`

Общая логика задачи:

- nearest / second nearest;
- `ΔZ`;
- `ΔZ/Z`;
- correct / wrong / uncertain;
- excluded candidates;
- response time;
- serializable snapshot.

## `training.js`

- forgiving hit area;
- score;
- feedback;
- progressive depth hints;
- unresolved rounds;
- Training animations.

## `experiment.js`

- no-feedback ranking;
- последовательный выбор объектов в одной сцене;
- `Не уверен`;
- response time;
- scene-level adaptive difficulty;
- trial recording.

## `storage.js`

- versioned localStorage;
- settings;
- autofocus state;
- Training history;
- Experiment history;
- schema migration.

---

# 3. Физическая модель экрана

Принято:

```text
screen diagonal = 10 in
viewing distance = 0.30 m
```

Сетка — обычный объект 3D-сцены, расположенный в плоскости экрана.

FOV вычисляется автоматически из:

- диагонали 10″;
- aspect ratio viewport;
- расстояния 30 см.

Ручной FOV больше не используется.

Объекты могут располагаться как перед плоскостью сетки, так и за ней.

---

# 4. Focus и autofocus

## Manual focus

По умолчанию:

```text
focus distance = 0.30 m
```

то есть точка схождения находится в центре плоскости сетки.

Ручной диапазон:

```text
0.12 ... 0.80 m
```

## Autofocus nearest object

В панели есть чекбокс:

```text
Autofocus nearest object
```

При включении:

- manual focus slider блокируется;
- на каждом кадре определяется ближайшая к камере поверхность среди всех видимых объектов;
- расстояние вычисляется до **реальной ближайшей точки поверхности mesh**, а не до центра объекта;
- bounding sphere используется только как быстрый lower-bound для отбора кандидатов;
- окончательный distance считается по треугольникам BufferGeometry;
- autofocus state сохраняется в localStorage;
- autofocus state записывается в параметры Training/Experiment session.

Важно: autofocus изменяет **только focus distance**, а не указывает пользователю местоположение правильного объекта.

---

# 5. Training Mode

## Правильный выбор

- ближайший объект исчезает;
- ответ засчитывается;
- следующая ближайшая фигура становится новой целью.

## Неправильный выбор

- фигура становится красно-белой;
- исключается из кандидатов текущего шага;
- повторный клик по ней не считается новой ошибкой;
- фигура может быть перемещена ближе к центру, если это не создаёт перекрытий.

## Depth hint

Истинно ближайшая фигура:

- приближается только по линии `camera → object`;
- не перемещается горизонтально;
- уменьшается пропорционально расстоянию;
- сохраняет видимый угловой размер.

```text
error 1 → distance × 0.80
error 2 → distance × 0.70
error 3 → distance × 0.62
```

После 3 значимых ошибок шаг считается `unresolved`, чтобы не возникал перебор всех объектов.

---

# 6. Experiment Mode — текущая логика

Experiment использует **ту же сцену и ту же задачу**, что Training, но без подсказок.

## Одна сцена = последовательное ранжирование

Пользователь:

1. выбирает ближайший объект;
2. при правильном выборе он исчезает;
3. затем выбирает ближайший среди оставшихся;
4. процесс продолжается до завершения сцены.

То есть одна сцена даёт последовательность:

```text
O1 < O2 < O3 < ... < On
```

## Неправильный выбор

- ошибка записывается;
- объект не окрашивается;
- ничего не перемещается;
- сцена не меняется;
- пользователь продолжает тот же шаг.

Повторный выбор уже проверенного неправильного кандидата должен игнорироваться Trial Engine.

## `Не уверен`

Кнопка означает:

```text
текущий шаг неразрешён
```

После нажатия:

- сохраняется `uncertain = true`;
- истинно ближайший объект молча удаляется;
- Experiment продолжается на той же сцене со следующим объектом;
- никаких hint animations нет.

## Adaptive difficulty

Сложность изменяется **между сценами**, а не после каждого клика.

Основной параметр:

```text
relative_delta = ΔZ / Z_nearest
```

Следующая сцена становится сложнее при высокой first-try accuracy и легче при большом числе ошибок / uncertain.

Текущая threshold estimation остаётся предварительной до появления `stats.js` и полноценного psychometric fit.

---

# 7. Persistent browser storage

Используется:

```text
mmp-lab-state
```

Сохраняются:

- language;
- panel state;
- last app mode;
- camera motion mode;
- baseline;
- frequency;
- waveform;
- manual focus distance;
- autofocusNearest;
- scene depth;
- screen calibration;
- last Training result;
- Training history;
- Experiment trial history.

Лимиты:

```text
Training history: 500 sessions
Experiment history: 2000 trials
```

Schema version должна повышаться при изменении persistent structure.

---

# 8. Параметры UI — текущие диапазоны

```text
Baseline:       0 ... 12 cm
Frequency:      0.2 ... 4 Hz
Focus:          0.12 ... 0.80 m
Scene depth:    0.10 ... 0.80 m
FOV:            auto
Screen:         10 in
Viewing dist.:  0.30 m
```

---

# 9. Statistics — следующий крупный блок

Добавить `Statistics` panel.

## Training

- last score;
- best score;
- sessions count;
- average score;
- last 10 average;
- unresolved rate;
- hints used;
- reaction time.

## Experiment

- steps count;
- scenes count;
- correct / wrong / uncertain;
- first-try accuracy;
- reaction time;
- current `ΔZ/Z`;
- threshold estimate;
- results by motion mode;
- results by baseline / frequency / Z;
- results with autofocus on/off.

---

# 10. Psychometric measurement

Строить:

```text
P(correct | ΔZ/Z)
```

Оценивать:

- 75% threshold;
- 80% threshold;
- 90% threshold.

Основная метрика:

```text
80% depth discrimination threshold
```

Уровни уверенности:

```text
< 20 trials   → Preliminary
20–50 trials  → Moderate confidence
> 50 trials   → Stable estimate
```

---

# 11. Главный эксперимент Static vs Motion

Сравнить одну и ту же ranking task при:

```text
Static
vs
Continuous motion parallax
```

Контролировать:

- Z;
- `ΔZ/Z`;
- object count;
- size;
- textures;
- layout;
- focus policy (manual / autofocus);
- screen calibration.

---

# 12. Blind / randomized experiment

В перспективе случайно выбирать:

- Static;
- L↔R;
- 5 viewpoints;
- Continuous.

Отдельно можно сравнить:

```text
Manual focus
vs
Autofocus nearest
```

---

# 13. Automatic Experiment Mode

Автоматически исследовать:

## Baseline

```text
2, 4, 6, 8, 10, 12 cm
```

## Frequency

```text
0.5, 1.0, 1.5, 2.0, 3.0 Hz
```

Стратегия:

```text
coarse scan
     ↓
best region
     ↓
fine scan
```

---

# 14. Individual perception profile

В перспективе:

```text
T(B, f, F, Z, mode, autofocus)
```

Пример:

```text
Best mode: Continuous
Best baseline: 8 cm
Best frequency: 1.4 Hz
Best focus policy: Autofocus nearest
80% threshold: 2.1%
```

---

# 15. Screen/device calibration

Текущий prototype фиксирован на:

```text
10 in / 30 cm
```

Позднее сделать пользовательскую calibration:

- physical screen width / diagonal;
- viewing distance.

После этого сравнивать результаты между устройствами.

---

# 16. Следующий порядок реализации

## Выполнено

- [x] Unified Training / Experiment architecture.
- [x] Trial Engine.
- [x] Modular refactor.
- [x] Persistent storage.
- [x] Training feedback/hints.
- [x] Experiment no-feedback ranking.
- [x] `Не уверен` удаляет ближайший объект и продолжает ту же сцену.
- [x] 10″ / 30 cm physical screen model.
- [x] Automatic FOV from physical screen geometry.
- [x] Manual focus default at screen plane.
- [x] Nearest-object autofocus checkbox.
- [x] Exact nearest-surface autofocus distance.
- [x] Autofocus persistence and session recording.

## Следующий блок — Statistics

- [ ] Statistics panel.
- [ ] Training statistics.
- [ ] Experiment statistics.
- [ ] Adaptive difficulty chart.
- [ ] Psychometric curve.
- [ ] More rigorous threshold estimation.

## Главные исследования

- [ ] Static vs Continuous protocol.
- [ ] Randomized/blind comparison.
- [ ] Manual focus vs autofocus comparison.
- [ ] Automatic baseline search.
- [ ] Automatic frequency search.
- [ ] User screen calibration.

## Следующий уровень

- [ ] Adaptive Training difficulty.
- [ ] Difficulty presets.
- [ ] Texture experiment.
- [ ] JSON export/import.
- [ ] Research Mode.
- [ ] Reproducible URL parameters.
- [ ] Personal report.

---

# 17. Главное правило развития

Каждую новую функцию оценивать вопросом:

> **Помогает ли она лучше измерить, обучить или понять monocular depth perception?**

Особенно важно различать:

- усиление depth cue;
- явное раскрытие местоположения правильного ответа.

Training может использовать первое.
Experiment не должен использовать второе.

---

# 18. Целевая модель

```text
                        Scene + Camera Motion
                                │
                                ▼
                           Trial Engine
                                │
                  ┌─────────────┴─────────────┐
                  │                           │
                  ▼                           ▼
              Training                    Experiment
                  │                           │
      progressive depth hints        no visual feedback
      score                          ranking + uncertain
      training history               response time
                  │                           │
                  └─────────────┬─────────────┘
                                ▼
                        Focus policy
                     manual / autofocus
                                │
                                ▼
                             Storage
                                │
                                ▼
                            Statistics
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
         Training          Psychometric      Parameter
         progress          threshold         optimization
```
