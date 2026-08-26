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
     adaptive difficulty      randomized conditions
     score                    reaction time
     learning                 threshold estimation
```

- **Training** — обучает.
- **Experiment** — измеряет.

Отдельный пользовательский режим старого двухобъектного Test больше не является центральной концепцией и удалён из основного UI.

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
├── ui.js
├── ROADMAP.md
└── далее:
    ├── storage.js
    ├── stats.js
    └── calibration.js
```

## `scene.js`

Отвечает за Three.js-сцену, объекты, геометрию, процедурные текстуры, сетки, освещение, генерацию сцены, размещение объектов и освобождение ресурсов.

## `camera-motion.js`

Отвечает за:

- Static;
- L ↔ R;
- 5 viewpoints;
- Continuous;
- baseline;
- frequency;
- waveform;
- focus distance;
- положение и направление камеры.

## `trial-engine.js`

Общая логика задачи «найди ближайший объект»:

- ранжирование объектов по расстоянию;
- nearest / second nearest;
- `ΔZ`;
- `ΔZ/Z`;
- correct / wrong;
- список уже исключённых кандидатов;
- число значимых ошибок;
- `unresolved`.

## `training.js`

Отвечает за:

- forgiving hit area;
- score;
- feedback;
- исключение ошибочных кандидатов;
- progressive depth hints;
- unresolved rounds;
- Training animations.

## `experiment.js`

Сейчас существует как базовый каркас. Полная измерительная логика — следующий этап.

## `ui.js`

Содержит UI-тексты и вспомогательную логику для Training / Experiment.

---

# 3. Training Mode — текущая логика

## Правильный выбор

Если пользователь выбирает ближайшую фигуру:

- фигура исчезает;
- засчитывается правильный выбор;
- следующим правильным ответом становится следующая ближайшая фигура;
- Training продолжается.

## Forgiving hit area

Клик считается выбором фигуры, если он попал:

- непосредственно в геометрию;
- либо в разумную экранную область вокруг фигуры.

## Неправильный выбор

Ошибочно выбранная фигура:

- становится красно-белой;
- считается уже проверенным неправильным кандидатом;
- плавно переносится горизонтально ближе к центральной области;
- при поиске позиции учитывается перекрытие с другими фигурами.

Повторный клик по уже исключённой фигуре:

- игнорируется;
- не считается новой ошибкой;
- не ухудшает score;
- не запускает новую подсказку.

## Подсказка правильной глубины

Истинно ближайшая фигура после ошибки:

- приближается к камере только по линии взора `camera → object`;
- не перемещается горизонтально;
- одновременно уменьшается в масштабе;
- сохраняет практически тот же видимый угловой размер.

Если:

```text
D → kD
```

то:

```text
S → kS
```

Подсказка усиливает depth cue, но не указывает положение ответа.

## Progressive hints

Сейчас сила приближения увеличивается при повторных ошибках.

Примерно:

```text
error 1 → distance × 0.80
error 2 → distance × 0.70
error 3 → distance × 0.62
```

Правильная фигура никогда не перемещается горизонтально к центру.

## Защита от перебора

После 3 значимых ошибок:

- текущий шаг считается `unresolved`;
- перебор всех фигур не продолжается;
- генерируется новая сцена;
- Training продолжается.

---

# 4. Генерация Training-сцены

Объекты по-прежнему используют большую часть поля зрения.

При этом для нескольких ближайших по глубине конкурентов горизонтальный разброс ограничен сильнее, чем для остальных объектов.

Цель:

- сохранить широкую пространственную сцену;
- не делать наиболее трудные depth comparisons искусственно неудобными из-за противоположных краёв экрана.

В дальнейшем эту логику нужно сделать формальнее: сначала сгенерировать глубины, затем выбрать ближайших 2–3 конкурента, после чего контролировать именно их экранное взаимное расположение.

---

# 5. Training score

Базовая метрика:

```text
score = correct / meaningful selections × 100%
```

Повторные клики по уже исключённым кандидатам не являются meaningful selections.

Текущий последний score остаётся видимым до начала следующего Training-сеанса.

Следующий этап — сохранять его также после reload браузера через `storage.js`.

---

# 6. Experiment Mode — следующий крупный блок

Experiment должен использовать тот же Trial Engine, но без Training feedback.

## Правила Experiment

- никаких красно-белых объектов после ответа;
- никаких hint animations;
- никаких перемещений после ошибки;
- никаких временных изменений baseline;
- после ответа сразу следующий trial.

## Ответ `Не уверен`

Добавить отдельный вариант:

```text
Не уверен
```

Хранить как:

```text
uncertain = true
```

Не смешивать автоматически с обычной ошибкой.

## Для каждого trial сохранять

```text
trial_id
session_id
timestamp
mode
baseline_cm
frequency_hz
waveform
focus_distance_m
fov_deg
nearest_distance_m
second_nearest_distance_m
delta_m
relative_delta
object_count
selected_object_id
correct
uncertain
response_time_ms
```

---

# 7. Storage

Создать `storage.js`.

Сохранять:

## Settings

- language;
- panel state;
- Training / Experiment last mode;
- camera motion mode;
- baseline;
- frequency;
- waveform;
- FOV;
- focus distance;
- scene depth;
- calibration values.

## Last Training result

```json
{
  "scorePercent": 87,
  "correct": 20,
  "wrong": 3,
  "unresolved": 1,
  "timestamp": "..."
}
```

## Training history

Хранить последние 100–500 сессий.

## Experiment history

Хранить последние 500–2000 trials или ограничивать историю по размеру storage.

## Schema version

```json
{
  "schemaVersion": 1
}
```

---

# 8. Statistics

Добавить отдельный раздел `Statistics`.

## Training statistics

- last score;
- best score;
- sessions count;
- average score;
- average last 10;
- best last 10;
- unresolved rate;
- average hints;
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

Не показывать слишком уверенную оценку при малом числе trials.

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

Предпочтительно использовать randomized interleaving.

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

Автоматически исследовать:

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

В перспективе оценивать:

```text
T(B, f, F, Z, mode)
```

и выводить, например:

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

Если пользователь играет уверенно:

- уменьшать `ΔZ/Z`;
- увеличивать object count;
- повышать плотность конкурентов;
- уменьшать силу hints.

Если ошибок много:

- увеличивать `ΔZ/Z`;
- уменьшать число близких конкурентов;
- усиливать motion cue.

Целевая Training accuracy:

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

Позднее добавить texture density:

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

Добавить reproducible URLs:

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
- импорт JSON для продолжения истории.

По умолчанию все данные остаются локально в браузере.

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

В перспективе:

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

Автоматически формировать итоговый отчёт:

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

Это главный рабочий checklist.

## A. Архитектура — выполнено в текущем проходе

- [x] 1. Убрать отдельный Test из центральной концепции UI.
- [x] 2. Зафиксировать два режима: Training / Experiment.
- [x] 3. Разделить `app.js` на модули.
- [x] 4. Создать `trial-engine.js`.
- [x] 5. Перенести игровую логику в `training.js`.
- [x] 6. Создать базовый `experiment.js`.

## B. Training — выполнено в текущем проходе

- [x] 7. Не считать повторный клик по уже исключённой фигуре новой ошибкой.
- [x] 8. Ввести максимум значимых ошибок на один шаг/раунд.
- [x] 9. Добавить `unresolved` outcome вместо перебора всех объектов.
- [x] 10. После повторной ошибки усиливать depth cue без горизонтального движения правильной фигуры.
- [x] 11. Ограничить горизонтальный разброс ближайших конкурентов при генерации сцены.
- [x] 12. Оставлять last Training score видимым до следующего Training-сеанса.

## C. Storage — следующий блок

- [ ] 13. Создать `storage.js`.
- [ ] 14. Сохранять UI/camera settings.
- [ ] 15. Сохранять last Training score после reload.
- [ ] 16. Сохранять Training history.
- [ ] 17. Сохранять Experiment trial history.
- [ ] 18. Добавить schema version.

## D. Experiment

- [ ] 19. Подключить Experiment к общему Trial Engine.
- [ ] 20. Сделать Experiment без feedback/hints.
- [ ] 21. Добавить ответ `Не уверен`.
- [ ] 22. Измерять response time.
- [ ] 23. Хранить `ΔZ/Z` ближайшей конкурирующей пары.
- [ ] 24. Добавить adaptive staircase.
- [ ] 25. Оценивать 80% threshold.

## E. Statistics

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

# 24. Ближайшие milestones

## Milestone 1 — Unified Training/Experiment architecture

Частично выполнен.

- [x] отдельный Test удалён из основного UI;
- [x] Training использует общий Trial Engine;
- [x] Training работает с progressive depth hints;
- [x] Experiment scaffold создан;
- [ ] Experiment подключён к Trial Engine;
- [ ] есть `Не уверен`;
- [ ] сохраняются response time и trial data.

## Milestone 2 — Measurement prototype

Готово, когда:

- [ ] сохраняется история;
- [ ] строится psychometric curve;
- [ ] оценивается threshold;
- [ ] можно сравнить Static и Motion.

## Milestone 3 — Research prototype

Готово, когда:

- [ ] experiments reproducible;
- [ ] есть calibration/device info;
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

Первая полезна для Training.

Вторая по возможности должна быть исключена.

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
      training history               randomized conditions
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
