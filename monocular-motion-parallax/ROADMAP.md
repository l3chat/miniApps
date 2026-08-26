# Monocular Motion Parallax Lab — Roadmap

Этот файл — основной рабочий план проекта. Он должен отражать **текущую концепцию**, а не историю всех обсуждений. Если архитектурное решение изменилось, старую идею лучше убрать или перенести в раздел «Отложено», чтобы не создавать двусмысленности.

---

# 0. Текущая концепция проекта

## Главная цель

Создать браузерный инструмент, который одновременно позволяет:

1. демонстрировать искусственный monocular motion parallax;
2. обучать человека различать глубину одним глазом;
3. количественно измерять качество такого восприятия;
4. сравнивать способы движения виртуальной камеры;
5. подбирать оптимальные параметры под конкретного пользователя;
6. получать воспроизводимые данные, пригодные для обсуждения с исследователями.

Главный исследовательский вопрос:

> **При каких параметрах искусственного временного параллакса конкретный человек лучше всего различает глубину одним глазом?**

---

# 1. Главное архитектурное решение

## Отдельный пользовательский режим «Тест» больше не является центральной концепцией

Основная задача в приложении одна:

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

То есть:

- **Training** — обучает;
- **Experiment** — измеряет.

Старый двухобъектный depth test можно временно сохранить в коде как вспомогательную 2AFC-процедуру, но он не должен определять архитектуру приложения и не обязан оставаться отдельной кнопкой в основном интерфейсе.

---

# 2. Единый Trial Engine

Создать общий модуль `trial-engine.js`.

Он должен отвечать за:

- генерацию сцены/задачи;
- определение истинного порядка объектов по глубине;
- определение текущего ближайшего объекта;
- регистрацию выбора пользователя;
- `correct / wrong / uncertain`;
- время ответа;
- параметры текущего trial;
- переход к следующему состоянию;
- передачу результатов в Training или Experiment policy.

Один trial должен хранить минимум:

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
mean_distance_m
nearest_distance_m
second_nearest_distance_m
delta_m
relative_delta
object_count
selected_object_id
correct
uncertain
response_time_ms
hint_level
```

В многообъектной сцене особенно важно хранить не только `ΔZ` вообще, а разницу между ближайшим и ближайшим конкурентом:

```text
ΔZ = Z(second nearest) - Z(nearest)
```

и

```text
relative_delta = ΔZ / Z(nearest)
```

---

# 3. Рефакторинг файлов

Рекомендуемая структура:

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
├── stats.js
├── calibration.js
└── ui.js
```

## `scene.js`

Отвечает за:

- Three.js scene;
- генерацию объектов;
- геометрию;
- процедурные текстуры;
- дальнюю вертикальную сетку;
- пол;
- освещение;
- распределение объектов;
- удаление объектов;
- освобождение WebGL-ресурсов.

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
- положение камеры;
- направление камеры;
- точку конвергенции.

## `trial-engine.js`

Общая логика задачи «найди ближайший объект».

## `training.js`

Отвечает за:

- score;
- forgiving hit area;
- feedback;
- progressive hints;
- adaptive difficulty;
- завершение нераспознанного раунда.

## `experiment.js`

Отвечает за:

- отсутствие feedback;
- randomized conditions;
- кнопку/ответ `Не уверен`;
- experiment blocks;
- staircase;
- Static vs Motion;
- автоматический поиск параметров.

## `storage.js`

Отвечает за:

- `localStorage`;
- настройки;
- историю Training;
- experiment trials;
- schema version;
- export/import.

## `stats.js`

Отвечает за:

- accuracy;
- rolling averages;
- reaction time;
- psychometric function;
- threshold;
- сравнение условий.

## `calibration.js`

Отвечает за:

- физический размер экрана;
- viewing distance;
- visual angle;
- device calibration.

## `ui.js`

Отвечает за:

- панели;
- mobile layout;
- statistics;
- charts;
- режимы Training / Experiment;
- сообщения пользователю.

### Критерий готовности рефакторинга

- [ ] Поведение текущей страницы сохранено.
- [ ] `app.js` содержит в основном initialization/wiring.
- [ ] Training и Experiment используют общий Trial Engine.
- [ ] Нет дублирования определения глубины/ближайшего объекта.
- [ ] Нет утечек geometry/material/texture.

---

# 4. Training Mode — окончательная логика

Training — основной пользовательский режим обучения.

## 4.1. Основная задача

Пользователь выбирает ближайшую фигуру.

Если выбор правильный:

- фигура исчезает;
- засчитывается правильный выбор;
- текущим правильным ответом становится следующая ближайшая фигура;
- игра продолжается до завершения сцены.

## 4.2. Forgiving hit area

Клик считается выбором фигуры, если он попал:

- непосредственно в фигуру;
- или в разумную область вокруг её экранной проекции.

Это особенно важно на смартфоне.

---

# 5. Training — неправильный выбор

## 5.1. Ошибочно выбранная фигура

При неправильном выборе:

1. фигура становится контрастно красно-белой;
2. она считается уже проверенным неправильным кандидатом для текущего шага;
3. она может быть перенесена горизонтально ближе к центру, если это помогает освободить сцену;
4. её перемещение не должно заслонять другие фигуры;
5. другие фигуры не должны заслонять её.

Повторный клик по уже исключённой фигуре:

- не должен давать новый штраф;
- не должен запускать новую подсказку;
- желательно либо игнорировать его, либо визуально показать, что кандидат уже исключён.

Это предотвращает искусственное ухудшение score.

## 5.2. Ближайшая фигура после ошибки

Реально ближайшая фигура:

- перемещается **только по линии взора камера → фигура**;
- приближается к камере;
- **не перемещается горизонтально**;
- одновременно уменьшается в мировом масштабе;
- сохраняет практически неизменный видимый угловой размер.

Если расстояние изменяется:

```text
D → kD
```

то масштаб меняется:

```text
S → kS
```

Например:

```text
D × 0.8
S × 0.8
```

Это усиливает motion-parallax cue, но не выдаёт положение правильного ответа.

## 5.3. Чего НЕ делать

Не перемещать правильную ближайшую фигуру горизонтально к центру.

Причина:

> это слишком явная подсказка, которая учит искать движение объекта, а не глубину.

---

# 6. Progressive hints в Training

Подсказки должны усиливать **признак глубины**, а не показывать ответ.

## Ошибка 1

- исключить неправильного кандидата;
- ближайший объект приблизить по лучу зрения;
- сохранить его угловой размер.

## Ошибка 2

- снова немного приблизить ближайший объект по тому же лучу;
- снова сохранить угловой размер.

## Ошибка 3

Можно временно усилить depth cue, например:

- baseline +20–30%;
- чуть снизить frequency, если это облегчает сравнение;
- или на короткое время усилить амплитуду motion parallax.

После правильного ответа вернуть обычные параметры.

## Ограничение числа ошибок

Не доводить сцену до перебора всех объектов.

После, например, 3–4 значимых ошибок подряд:

- пометить текущий шаг/раунд как `unresolved`;
- закончить его;
- перейти к следующей сцене;
- немного увеличить depth separation следующей задачи.

Это принципиально важно, чтобы стратегия

> «нажму всё подряд»

не была рабочей.

---

# 7. Training — генерация сцены

Объекты должны использовать большую часть доступного поля зрения.

Но при этом:

- несколько ближайших по глубине конкурирующих объектов не должны систематически оказываться на противоположных краях экрана;
- сложные depth comparisons должны оставаться зрительно выполнимыми;
- вся сцена при этом может оставаться широкой.

То есть не надо сжимать всю сцену к центру — нужно контролировать расположение именно ближайших конкурентов.

## Возможная стратегия

1. Сначала сгенерировать глубины.
2. Найти 2–3 ближайших объекта.
3. Для них ограничить максимальную экранную дистанцию между центрами.
4. Остальные объекты распределять почти по всей ширине.

---

# 8. Training score

Базовая метрика:

```text
score = correct / all meaningful selections × 100%
```

Важно:

- повторные клики по уже исключённому объекту не считаются новым meaningful selection;
- последний score остаётся видимым после окончания игры;
- он сохраняется до начала следующей игры;
- позднее сохраняется и после reload страницы.

Дополнительно в будущем:

- reaction time;
- streak;
- best streak;
- mistakes per scene;
- hints used;
- unresolved rounds;
- final difficulty.

---

# 9. Experiment Mode

Experiment использует **ту же задачу и тот же Trial Engine**, но принципиально другую обратную связь.

## 9.1. Основные правила

В Experiment:

- никаких красно-белых фигур после ответа;
- никаких перемещений объектов после ошибки;
- никаких hint animations;
- никаких временных изменений baseline;
- ответ пользователя не должен влиять на текущий trial визуально.

После ответа начинается следующий trial.

## 9.2. Ответ `Не уверен`

Добавить отдельный ответ:

```text
Не уверен
```

Это лучше, чем вынуждать человека угадывать.

Хранить отдельно:

```text
uncertain = true
```

Не смешивать его автоматически с обычной ошибкой.

## 9.3. Что измерять

Для каждого experiment trial:

- correct / wrong / uncertain;
- response time;
- `ΔZ/Z` ближайшей пары-конкурентов;
- Z;
- baseline;
- frequency;
- mode;
- waveform;
- focus;
- FOV;
- device/calibration info;
- object count;
- random seed.

---

# 10. Adaptive difficulty

## Training

Если пользователь играет уверенно:

- уменьшать `ΔZ/Z`;
- увеличивать число объектов;
- повышать плотность ближайших конкурентов;
- уменьшать силу подсказок.

Если ошибок много:

- увеличивать `ΔZ/Z`;
- уменьшать число конкурирующих близких объектов;
- усиливать motion cue.

Целевая accuracy для обучения:

```text
75–85%
```

## Experiment

Использовать staircase или другую формальную adaptive procedure.

Цель — оценка psychometric threshold, а не поддержание ощущения успеха.

---

# 11. Хранение данных в браузере

Создать нормальный `storage.js`.

## 11.1. Settings

Сохранять:

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

## 11.2. Last Training result

```json
{
  "scorePercent": 87,
  "correct": 20,
  "wrong": 3,
  "unresolved": 1,
  "timestamp": "..."
}
```

## 11.3. Training history

Хранить последние 100–500 сессий/игр.

## 11.4. Experiment history

Хранить последние 500–2000 trials либо ограничивать объём по размеру storage.

## 11.5. Schema version

```json
{
  "schemaVersion": 1
}
```

### Критерий готовности

- [ ] После reload возвращаются настройки.
- [ ] Последний Training score остаётся видимым.
- [ ] История Training сохраняется.
- [ ] Experiment trials сохраняются.
- [ ] Есть безопасная миграция schema version.

---

# 12. Statistics

Добавить раздел `Statistics`.

## Training statistics

- last score;
- best score;
- games/sessions count;
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
- result by motion mode;
- result by baseline/frequency/Z.

Добавить:

- Export data;
- Clear history;
- Reset statistics.

Перед очисткой данных — confirmation.

---

# 13. Psychometric measurement

Строить:

```text
P(correct | ΔZ/Z)
```

Оценивать минимум:

- 75% threshold;
- 80% threshold;
- 90% threshold.

Основная метрика по умолчанию:

```text
80% depth discrimination threshold
```

Пример:

```text
Estimated threshold:
ΔZ/Z ≈ 2.8% at 80% correct
```

Не показывать слишком уверенную оценку при малом числе данных.

Например:

```text
< 20 trials   → Preliminary estimate
20–50 trials  → Moderate confidence
> 50 trials   → Stable estimate
```

---

# 14. Графики

## Adaptive staircase

X:

```text
trial number
```

Y:

```text
ΔZ/Z (%)
```

Отмечать:

- correct;
- wrong;
- uncertain.

## Psychometric curve

```text
P(correct | ΔZ/Z)
```

## Training progress

```text
Today
7 days
30 days
All time
```

---

# 15. Static vs Motion — ключевой эксперимент

Сравнивать одну и ту же задачу при:

```text
Static
vs
Continuous motion parallax
```

Контролировать:

- Z;
- ΔZ/Z;
- object count;
- object sizes;
- textures;
- layout;
- FOV;
- focus.

Меняется только camera motion condition.

Предпочтительно randomized interleaving.

Пример результата:

```text
Static:
accuracy 58%
threshold 9.4%

Continuous:
accuracy 84%
threshold 2.9%

Improvement:
+26 percentage points
```

---

# 16. Blind / randomized experiment

Случайно выбирать condition:

- Static;
- L ↔ R;
- 5 viewpoints;
- Continuous.

Пользователь не знает condition текущего trial/block.

После серии показывать результаты по условиям.

---

# 17. Automatic Experiment Mode

Программа сама исследует параметры.

## Motion mode

- Static;
- L ↔ R;
- 5 viewpoints;
- Continuous.

## Baseline coarse search

```text
2, 4, 6, 8, 10, 12, 16 cm
```

## Frequency coarse search

```text
0.5, 1.0, 1.5, 2.0, 3.0 Hz
```

Не делать полный brute-force по всем сочетаниям.

Стратегия:

```text
coarse scan
     ↓
best region
     ↓
fine scan
```

Результат:

```text
Best configuration found:
Mode: Continuous
Baseline: 9 cm
Frequency: 1.4 Hz
Threshold: ΔZ/Z = 2.0%
```

---

# 18. Individual perception profile

Постепенно оценивать зависимость:

```text
T(B, f, F, Z, mode)
```

где:

- B — baseline;
- f — frequency;
- F — focus distance;
- Z — distance;
- mode — motion mode.

В перспективе:

```text
Best mode: Continuous
Best baseline: 9.5 cm
Best frequency: 1.4 Hz
Estimated threshold: 2.1%
```

---

# 19. Screen/device calibration

Для сопоставимости результатов запросить:

- physical screen width или diagonal;
- viewing distance.

Вычислять visual angle:

```text
theta = 2 * atan((w / 2) / D)
```

Сохранять:

- viewport;
- pixel ratio;
- orientation;
- physical screen size;
- viewing distance.

Не собирать лишние персональные идентификаторы.

---

# 20. Training difficulty levels

После базового Training добавить presets:

## Easy

- меньше объектов;
- большой depth spread;
- сильный motion cue.

## Normal

Средние значения.

## Hard

- больше объектов;
- меньший `ΔZ/Z`;
- больше конкурентов.

## Expert

- малые depth differences;
- высокая плотность;
- минимум hints.

Позднее ручные уровни можно заменить adaptive difficulty.

---

# 21. Textures as experimental variable

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

Исследовательский вопрос:

> Улучшает ли поверхностная структура восприятие motion parallax и зависит ли эффект от spatial frequency текстуры?

---

# 22. Reproducibility

Каждая experiment session должна иметь:

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

# 23. Export / Import

## CSV

Для Excel / Python / R.

## JSON

Для полного восстановления данных.

## Summary

Например:

```text
Session
Date
Device
Viewing distance
Best mode
Best baseline
Best frequency
Estimated threshold
Static vs Motion improvement
```

Импорт JSON должен позволять:

- переносить историю;
- продолжать experiment history;
- передавать данные исследователю.

---

# 24. Privacy

По умолчанию:

> Все результаты и настройки хранятся локально в браузере.

Ничего не отправлять на сервер без отдельного явного действия пользователя.

---

# 25. Mobile and performance quality

Проверять:

- Android portrait;
- Android landscape;
- iPhone portrait;
- tablet;
- desktop.

Критерии:

- viewer не исчезает;
- controls не перекрывают viewer;
- targets удобно нажимать;
- charts читаемы;
- layout корректен после orientation change.

Sanity checks:

```text
viewer width > 0
viewer height > 0
canvas width > 0
canvas height > 0
```

Performance goals:

```text
target ≥ 30 FPS
preferred ≥ 50 FPS
```

При низком FPS:

- уменьшать pixel ratio;
- упрощать geometry;
- уменьшать anisotropy;
- уменьшать object count.

---

# 26. Research Mode

В обычном режиме интерфейс должен оставаться простым.

В Research Mode показывать:

- exact parameters;
- trial number;
- random seed;
- staircase state;
- raw data;
- psychometric fit;
- confidence intervals;
- data-quality warnings.

---

# 27. Data quality

Помечать, но не удалять автоматически:

- слишком быстрые ответы;
- очень длинные паузы;
- FPS drops;
- необычные серии ответов.

Поле:

```text
quality_warning
```

---

# 28. Long-term training study

Позднее реализовать:

```text
Pre-test
Training
Post-test
```

и долгосрочные точки:

```text
Day 1
Day 3
Day 7
Day 14
Day 30
```

Сравнивать threshold до/после обучения и устойчивость эффекта.

---

# 29. Personal report

В перспективе автоматически формировать:

```text
Monocular Motion Parallax Report

Sessions: 12
Trials: 840
Training games: 35

Best motion mode: Continuous
Best baseline: 8–10 cm
Best frequency: 1.2–1.7 Hz
80% depth threshold: 2.4%
Static threshold: 8.7%
Motion improvement: 72%
Training improvement over 14 days: 31%
```

---

# 30. About / Method

Добавить раздел, объясняющий:

- stereopsis;
- monocular motion parallax;
- temporal presentation;
- идею виртуальных viewpoints;
- зачем Training;
- что измеряет Experiment.

Краткая концепция:

```text
L → L½ → C → R½ → R → ...
```

```text
spatial disparity
→ temporal disparity
→ motion parallax
```

---

# 31. Ближайший порядок реализации

Это **главный рабочий checklist**. Идти сверху вниз, если нет веской причины изменить порядок.

## A. Архитектура

- [ ] 1. Убрать отдельный Test из центральной концепции UI.
- [ ] 2. Зафиксировать два режима: Training / Experiment.
- [ ] 3. Разделить `app.js` на модули.
- [ ] 4. Создать `trial-engine.js`.
- [ ] 5. Перенести игровую логику в `training.js`.
- [ ] 6. Создать базовый `experiment.js`.

## B. Training

- [ ] 7. Не считать повторный клик по уже исключённой фигуре новой ошибкой.
- [ ] 8. Ввести максимум значимых ошибок на один шаг/раунд.
- [ ] 9. Добавить `unresolved` outcome вместо перебора всех объектов.
- [ ] 10. После повторной ошибки усиливать depth cue без горизонтального движения правильной фигуры.
- [ ] 11. Контролировать взаимное положение 2–3 ближайших конкурентов при генерации сцены.
- [ ] 12. Сохранять last Training score.

## C. Storage

- [ ] 13. Создать `storage.js`.
- [ ] 14. Сохранять UI/camera settings.
- [ ] 15. Сохранять Training history.
- [ ] 16. Сохранять Experiment trial history.
- [ ] 17. Добавить schema version.

## D. Experiment

- [ ] 18. Сделать Experiment без feedback/hints.
- [ ] 19. Добавить ответ `Не уверен`.
- [ ] 20. Измерять response time.
- [ ] 21. Хранить `ΔZ/Z` ближайшей конкурирующей пары.
- [ ] 22. Добавить adaptive staircase.
- [ ] 23. Оценивать 80% threshold.

## E. Statistics

- [ ] 24. Добавить Statistics panel.
- [ ] 25. Training statistics.
- [ ] 26. Experiment statistics.
- [ ] 27. Adaptive staircase chart.
- [ ] 28. Psychometric curve.

## F. Главные исследования

- [ ] 29. Static vs Continuous protocol.
- [ ] 30. Randomized/blind comparison.
- [ ] 31. Автоматический поиск baseline.
- [ ] 32. Автоматический поиск frequency.
- [ ] 33. Screen calibration.

## G. Следующий уровень

- [ ] 34. Adaptive Training difficulty.
- [ ] 35. Difficulty presets.
- [ ] 36. Texture experiment.
- [ ] 37. JSON export/import.
- [ ] 38. Research Mode.
- [ ] 39. Reproducible URL parameters.
- [ ] 40. Personal report.

---

# 32. Что считается ближайшей крупной вехой

## Milestone 1 — Unified Training/Experiment architecture

Готово, когда:

- [ ] нет отдельной дублирующей логики Test/Game;
- [ ] Training и Experiment используют один Trial Engine;
- [ ] Training обучает с подсказками;
- [ ] Experiment измеряет без подсказок;
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

- [ ] эксперименты воспроизводимы;
- [ ] есть calibration/device info;
- [ ] есть randomized conditions;
- [ ] есть export raw data;
- [ ] есть confidence intervals;
- [ ] можно автоматически искать лучшие параметры.

---

# 33. Главное правило развития

Каждую новую функцию оценивать вопросом:

> **Помогает ли она лучше измерить, обучить или понять monocular depth perception?**

Если нет — её приоритет ниже.

Особенно важно не путать:

- **подсказку, усиливающую depth cue**;
- **подсказку, раскрывающую местоположение правильного ответа**.

Первая полезна для Training.

Вторая по возможности должна быть исключена.

---

# 34. Итоговая целевая модель проекта

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

Это и есть текущая целевая архитектура проекта.
