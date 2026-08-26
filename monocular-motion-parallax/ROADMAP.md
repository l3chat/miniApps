# Monocular Motion Parallax Lab — Roadmap

Этот файл — основной рабочий план проекта. Он отражает текущую концепцию и фактический прогресс. Выполненные пункты отмечаются `[x]`.

---

# 0. Главная цель

Создать браузерный инструмент, который позволяет:

1. демонстрировать искусственный monocular motion parallax;
2. обучать человека различать глубину одним глазом;
3. количественно измерять качество такого восприятия;
4. сравнивать способы движения виртуальной камеры;
5. подбирать оптимальные параметры под конкретного пользователя;
6. получать воспроизводимые данные, пригодные для обсуждения с исследователями.

Главный исследовательский вопрос:

> **При каких параметрах искусственного временного параллакса конкретный человек лучше всего различает глубину одним глазом?**

---

# 1. Текущая архитектурная концепция

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
     adaptive difficulty      adaptive staircase
     score                    reaction time
     learning                 threshold estimation
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
├── ROADMAP.md
└── далее:
    ├── stats.js
    └── calibration.js
```

## `scene.js`

Three.js-сцена, объекты, геометрия, текстуры, сетки, освещение, Training-scene generation, controlled Experiment-scene generation и освобождение ресурсов.

## `camera-motion.js`

Static / L↔R / 5 viewpoints / Continuous, baseline, frequency, waveform, focus distance, положение и направление камеры.

## `trial-engine.js`

Общая логика задачи «найди ближайший объект»:

- nearest / second nearest;
- `ΔZ`;
- `ΔZ/Z`;
- correct / wrong / uncertain;
- excluded candidates;
- meaningful errors;
- `unresolved`;
- response time;
- serializable trial snapshot.

## `training.js`

Forgiving hit area, score, feedback, progressive depth hints, unresolved rounds, Training animations и жизненный цикл Training-сессии.

## `experiment.js`

Полноценный no-feedback Experiment:

- общий Trial Engine;
- controlled `ΔZ/Z`;
- `Не уверен`;
- response time;
- 3-down/1-up staircase;
- reversal tracking;
- preliminary 80% threshold estimate;
- запись каждого trial в storage.

## `storage.js`

Versioned local browser storage:

- settings;
- last Training result;
- Training history;
- Experiment trial history;
- schema migration.

---

# 3. Training Mode — текущая логика

## Правильный выбор

- ближайшая фигура исчезает;
- ответ засчитывается;
- следующая ближайшая становится новой целью.

## Forgiving hit area

Клик считается выбором, если он попал в объект или в разумную экранную область вокруг него.

## Неправильный выбор

Ошибочная фигура:

- становится красно-белой;
- исключается из кандидатов текущего шага;
- переносится горизонтально ближе к центральной области, если есть свободная позиция;
- повторный клик по ней игнорируется.

## Подсказка правильной глубины

Истинно ближайшая фигура:

- приближается только по линии взора `camera → object`;
- не двигается горизонтально;
- уменьшается пропорционально расстоянию;
- сохраняет практически тот же видимый угловой размер.

```text
error 1 → distance × 0.80
error 2 → distance × 0.70
error 3 → distance × 0.62
```

## Защита от перебора

После 3 значимых ошибок:

- шаг становится `unresolved`;
- перебор всех объектов прекращается;
- генерируется новая сцена.

---

# 4. Генерация Training-сцены

Объекты используют большую часть поля зрения, но несколько ближайших конкурентов получают более ограниченный горизонтальный разброс.

В дальнейшем сделать это формальнее:

1. сгенерировать глубины;
2. определить 2–3 ближайших объекта;
3. контролировать именно их экранное расстояние;
4. остальные объекты распределять широко.

---

# 5. Training score и история

```text
score = correct / meaningful selections × 100%
```

Сейчас:

- last score остаётся видимым после Training;
- сохраняется после reload браузера;
- Training-сессия записывается при stop / switch / reset / win;
- сохраняются `correct`, `wrong`, `unresolved`, duration, camera и scene parameters;
- история ограничена последними 500 сессиями.

---

# 6. Persistent browser storage — выполнено

Используется единый ключ:

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
- FOV;
- focus distance;
- scene depth;
- future calibration field;
- last Training result;
- Training history;
- Experiment trial history.

Лимиты:

- Training: 500 sessions;
- Experiment: 2000 trials.

Schema:

```json
{
  "schemaVersion": 1
}
```

---

# 7. Experiment Mode — базовый измерительный режим выполнен

Experiment использует тот же Trial Engine, но без Training feedback.

## Правила

- никаких красно-белых объектов после ответа;
- никаких hint animations;
- никаких перемещений после ошибки;
- никаких временных изменений baseline;
- после ответа сразу новый trial;
- параметры камеры и сцены блокируются на время Experiment session.

## Ответ `Не уверен`

Есть отдельный ответ:

```text
Не уверен
```

Он сохраняется как:

```text
uncertain = true
```

и не смешивается с обычной ошибкой.

## Controlled Experiment scene

Для каждого trial программа задаёт контролируемую разницу между двумя ближайшими объектами:

```text
relative_delta = ΔZ / Z_nearest
```

Расстояния задаются как точные 3D-distance от камеры по лучам зрения, поэтому горизонтальное положение объекта не искажает заданный `ΔZ/Z`.

Остальные объекты размещаются дальше ближайшей пары.

## Adaptive staircase

Используется:

```text
3-down / 1-up
```

- после 3 правильных подряд задача усложняется;
- после 1 ошибки задача облегчается;
- `Не уверен` также ведёт к облегчению следующего trial;
- step factor ≈ 1.22;
- диапазон `ΔZ/Z`: 0.2% … 30%.

Такая процедура ориентирована примерно на уровень 79–80% correct.

## Reversals и 80% threshold

При смене направления staircase сохраняется reversal.

После минимум 4 reversals появляется предварительная оценка 80%-порога как геометрическое среднее последних reversal levels.

Это пока **staircase estimate**, а не окончательный psychometric fit. Более строгая оценка появится в `stats.js`.

## Для каждого trial сохраняются

```text
trialId
sessionId
timestamp
trialNo
outcome
correct
uncertain
selectedObjectId
objectCount
responseTimeMs
targetRelativeDelta
nearestDistanceM
secondNearestDistanceM
deltaM
relativeDelta
staircase state
camera mode
baseline
frequency
waveform
focus distance
FOV
scene depth
```

---

# 8. Statistics — следующий крупный блок

Добавить отдельный раздел `Statistics`.

## Training statistics

- last score;
- best score;
- sessions count;
- average score;
- average last 10;
- best last 10;
- unresolved rate;
- reaction time.

## Experiment statistics

- trials count;
- accuracy;
- uncertain rate;
- response time;
- current `ΔZ/Z`;
- threshold estimate;
- results by motion mode;
- results by baseline / frequency / Z.

---

# 9. Psychometric measurement

Строить:

```text
P(correct | ΔZ/Z)
```

Оценивать минимум:

- 75% threshold;
- 80% threshold;
- 90% threshold.

Основная метрика:

```text
80% depth discrimination threshold
```

Уровни уверенности:

```text
< 20 trials   → Preliminary estimate
20–50 trials  → Moderate confidence
> 50 trials   → Stable estimate
```

---

# 10. Главный эксперимент Static vs Motion

Сравнить одну и ту же задачу при:

```text
Static
vs
Continuous motion parallax
```

Контролировать:

- Z;
- `ΔZ/Z`;
- object count;
- object sizes;
- textures;
- layout;
- FOV;
- focus.

Предпочтительно randomized interleaving.

---

# 11. Blind / randomized experiment

Случайно выбирать condition:

- Static;
- L ↔ R;
- 5 viewpoints;
- Continuous.

Пользователь не знает condition текущего trial/block.

---

# 12. Automatic Experiment Mode

Исследовать автоматически:

## Baseline

```text
2, 4, 6, 8, 10, 12, 16 cm
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

# 13. Individual perception profile

В перспективе:

```text
T(B, f, F, Z, mode)
```

Пример:

```text
Best mode: Continuous
Best baseline: 9.5 cm
Best frequency: 1.4 Hz
Estimated threshold: 2.1%
```

---

# 14. Screen/device calibration

Запрашивать:

- physical screen width / diagonal;
- viewing distance.

Вычислять visual angle:

```text
theta = 2 * atan((w / 2) / D)
```

Сохранять viewport, pixel ratio, orientation, physical screen size и viewing distance.

---

# 15. Adaptive Training

При хорошей игре:

- уменьшать `ΔZ/Z`;
- увеличивать object count;
- повышать плотность конкурентов;
- уменьшать hints.

При ошибках:

- увеличивать `ΔZ/Z`;
- уменьшать число близких конкурентов;
- усиливать motion cue.

Целевая accuracy:

```text
75–85%
```

---

# 16. Textures as experimental variable

Сравнить:

- solid;
- squares;
- triangles;
- checker;
- random texture.

Позднее:

```text
coarse
medium
fine
```

---

# 17. Reproducibility

Каждая Experiment session должна иметь:

```text
session_id
random_seed
timestamp
protocol_version
```

Добавить reproducible URL:

```text
?mode=continuous
&baseline=8
&frequency=1.6
&fov=55
&focus=5
```

---

# 18. Export / Import

Поддержать:

- CSV;
- JSON;
- summary report;
- импорт JSON.

По умолчанию данные остаются локально в браузере.

---

# 19. Mobile and performance

Проверять:

- Android portrait;
- Android landscape;
- iPhone portrait;
- tablet;
- desktop.

Sanity checks:

```text
viewer width > 0
viewer height > 0
canvas width > 0
canvas height > 0
```

Цели:

```text
target ≥ 30 FPS
preferred ≥ 50 FPS
```

---

# 20. Research Mode

Позднее показывать:

- exact parameters;
- trial number;
- random seed;
- staircase state;
- raw data;
- psychometric fit;
- confidence intervals;
- data-quality warnings.

---

# 21. Long-term training study

```text
Pre-test
Training
Post-test
```

и:

```text
Day 1
Day 3
Day 7
Day 14
Day 30
```

---

# 22. Personal report

Формировать:

```text
Sessions
Trials
Training games
Best motion mode
Best baseline
Best frequency
80% depth threshold
Static threshold
Motion improvement
Training improvement
```

---

# 23. Ближайший порядок реализации

## A. Архитектура — выполнено

- [x] 1. Убрать отдельный Test из центральной концепции UI.
- [x] 2. Зафиксировать два режима: Training / Experiment.
- [x] 3. Разделить `app.js` на модули.
- [x] 4. Создать `trial-engine.js`.
- [x] 5. Перенести игровую логику в `training.js`.
- [x] 6. Создать базовый `experiment.js`.

## B. Training — выполнено

- [x] 7. Не считать повторный клик по уже исключённой фигуре новой ошибкой.
- [x] 8. Ввести максимум значимых ошибок на один шаг/раунд.
- [x] 9. Добавить `unresolved` outcome вместо перебора всех объектов.
- [x] 10. После повторной ошибки усиливать depth cue без горизонтального движения правильной фигуры.
- [x] 11. Ограничить горизонтальный разброс ближайших конкурентов.
- [x] 12. Оставлять last Training score видимым до следующего Training-сеанса.

## C. Storage — выполнено

- [x] 13. Создать `storage.js`.
- [x] 14. Сохранять UI/camera settings.
- [x] 15. Сохранять last Training score после reload.
- [x] 16. Сохранять Training history.
- [x] 17. Подготовить persistent Experiment trial history и канал записи trials.
- [x] 18. Добавить schema version и migration path.

## D. Experiment — выполнено

- [x] 19. Подключить Experiment к общему Trial Engine.
- [x] 20. Сделать Experiment без feedback/hints.
- [x] 21. Добавить ответ `Не уверен`.
- [x] 22. Измерять response time.
- [x] 23. Хранить фактический `ΔZ/Z` ближайшей конкурирующей пары.
- [x] 24. Добавить adaptive 3-down/1-up staircase.
- [x] 25. Оценивать предварительный 80% threshold по reversal levels.

## E. Statistics — следующий блок

- [ ] 26. Добавить Statistics panel.
- [ ] 27. Training statistics.
- [ ] 28. Experiment statistics.
- [ ] 29. Adaptive staircase chart.
- [ ] 30. Psychometric curve.

## F. Главные исследования

- [ ] 31. Static vs Continuous protocol.
- [ ] 32. Randomized/blind comparison.
- [ ] 33. Автоматический поиск baseline.
- [ ] 34. Автоматический поиск frequency.
- [ ] 35. Screen calibration.

## G. Следующий уровень

- [ ] 36. Adaptive Training difficulty.
- [ ] 37. Difficulty presets.
- [ ] 38. Texture experiment.
- [ ] 39. JSON export/import.
- [ ] 40. Research Mode.
- [ ] 41. Reproducible URL parameters.
- [ ] 42. Personal report.

---

# 24. Milestones

## Milestone 1 — Unified Training/Experiment architecture — выполнен

- [x] отдельный Test удалён;
- [x] Training использует Trial Engine;
- [x] Training работает с progressive depth hints;
- [x] Experiment использует Trial Engine;
- [x] persistent storage создан;
- [x] есть `Не уверен`;
- [x] Experiment сохраняет реальные response time и trial data;
- [x] adaptive staircase работает;
- [x] preliminary 80% threshold доступен.

## Milestone 2 — Measurement prototype

- [x] Training history сохраняется;
- [x] Experiment history наполняется реальными trials;
- [ ] строится psychometric curve;
- [ ] есть более строгая threshold estimation;
- [ ] можно сравнить Static и Motion.

## Milestone 3 — Research prototype

- [ ] experiments reproducible;
- [ ] calibration/device info;
- [ ] randomized conditions;
- [ ] export raw data;
- [ ] confidence intervals;
- [ ] automatic parameter optimization.

---

# 25. Главное правило развития

Каждую новую функцию оценивать вопросом:

> **Помогает ли она лучше измерить, обучить или понять monocular depth perception?**

Особенно важно различать:

- подсказку, усиливающую **depth cue**;
- подсказку, раскрывающую **местоположение ответа**.

Первая полезна для Training. Вторая по возможности должна быть исключена.

---

# 26. Целевая модель проекта

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
      adaptive difficulty            uncertain response
      score                          response time
      training history               adaptive staircase
                  │                           │
                  └─────────────┬─────────────┘
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
