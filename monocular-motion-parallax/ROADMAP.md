# Monocular Motion Parallax Lab — Roadmap

Этот файл — рабочий план развития проекта. Его следует поддерживать вместе с кодом: отмечать выполненные пункты, уточнять критерии готовности и добавлять новые идеи только после оценки их исследовательской ценности.

## 0. Главная цель

Превратить текущую веб-страницу из интерактивной демонстрации в инструмент для:

1. демонстрации искусственного monocular motion parallax;
2. психофизического тестирования восприятия глубины одним глазом;
3. тренировки различения глубины;
4. сбора индивидуальной статистики;
5. оценки порога восприятия глубины;
6. сравнения режимов движения камеры;
7. автоматической оптимизации параметров под пользователя;
8. подготовки воспроизводимых результатов для обсуждения с исследователями.

Главный вопрос проекта:

> **При каких параметрах искусственного временного параллакса конкретный человек лучше всего различает глубину одним глазом?**

Общая цепочка развития:

```text
Demo
  ↓
Test
  ↓
Training
  ↓
Measurement
  ↓
Optimization
```

---

# 1. Рефакторинг и архитектура

## 1.1. Разделить `app.js`

Предлагаемая структура:

```text
monocular-motion-parallax/
├── index.html
├── styles.css
├── game.css
├── app.js
├── i18n.js
├── scene.js
├── camera-motion.js
├── test.js
├── game.js
├── storage.js
├── stats.js
├── experiment.js
├── calibration.js
└── ui.js
```

### `scene.js`

Отвечает за:

- Three.js-сцену;
- объекты и геометрию;
- материалы и процедурные текстуры;
- дальнюю вертикальную сетку;
- пол и освещение;
- генерацию новой сцены;
- размещение объектов;
- освобождение WebGL-ресурсов.

### `camera-motion.js`

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
- точку конвергенции.

### `test.js`

Отвечает за:

- генерацию пары объектов;
- `ΔZ / Z`;
- adaptive staircase;
- ответы пользователя;
- запись результатов;
- autofocus между объектами.

### `game.js`

Отвечает за:

- запуск и остановку игры;
- выбор ближайшего объекта;
- forgiving hit area;
- правильные/неправильные клики;
- подсказки;
- перемещение фигур;
- сохранение видимого размера при приближении;
- игровой счёт.

### `storage.js`

Отвечает за:

- `localStorage`;
- настройки;
- историю тестов;
- историю игр;
- версию схемы данных;
- экспорт/импорт.

### `stats.js`

Отвечает за:

- проценты;
- средние значения;
- best score;
- rolling average;
- psychometric function;
- threshold `ΔZ/Z`.

### `experiment.js`

Отвечает за:

- randomized/blind experiment;
- Static vs Motion;
- блоки испытаний;
- автоматический перебор параметров.

### `calibration.js`

Отвечает за:

- физический размер экрана;
- viewing distance;
- визуальный угол;
- начальную калибровку baseline.

### `ui.js`

Отвечает за:

- панели управления;
- mobile layout;
- отображение статистики;
- графики;
- сообщения.

### Критерий готовности

- [ ] Поведение страницы не изменилось после рефакторинга.
- [ ] `app.js` содержит только инициализацию и связывание модулей.
- [ ] Нет дублирования логики.
- [ ] Нет утечек geometry/texture/material.

---

# 2. Система сохранения состояния

## 2.1. Настройки интерфейса

Сохранять в `localStorage`:

- язык;
- скрыта/открыта панель;
- последний активный режим;
- mobile/desktop UI preferences, если появятся.

## 2.2. Настройки камеры

Сохранять:

- motion mode;
- baseline;
- frequency;
- waveform;
- FOV;
- focus distance;
- scene depth.

## 2.3. Настройки теста

Сохранять:

- последний `ΔZ/Z`;
- autofocus on/off;
- диапазон `Z`;
- параметры adaptive staircase.

## 2.4. Последний игровой результат

Формат примерно такой:

```json
{
  "scorePercent": 87,
  "correct": 20,
  "wrong": 3,
  "timestamp": "..."
}
```

Требования:

- результат остаётся видимым после игры;
- переживает reload страницы;
- сбрасывается только при старте новой игры.

## 2.5. История игр

Хранить минимум последние 100 игр:

```json
{
  "timestamp": "...",
  "scorePercent": 87,
  "correct": 20,
  "wrong": 3,
  "durationSec": 95,
  "baselineCm": 8,
  "frequencyHz": 1.6,
  "mode": "continuous"
}
```

## 2.6. История теста

Хранить последние 500–2000 попыток.

Для каждой попытки:

```text
timestamp
mode
baseline_cm
frequency_hz
waveform
focus_distance_m
mean_distance_m
delta_m
relative_delta
relative_delta_percent
left_shape
right_shape
correct
response_time_ms
```

## 2.7. Версионирование

Все persistent data должны иметь:

```json
{
  "schemaVersion": 1
}
```

### Критерий готовности

- [ ] После reload возвращаются настройки.
- [ ] Последний игровой счёт виден.
- [ ] История тестов и игр сохраняется.
- [ ] Старые данные можно мигрировать при изменении схемы.

---

# 3. Панель Statistics

Добавить отдельный раздел `Statistics`.

## Test statistics

Показывать:

- число попыток;
- общую точность;
- текущий `ΔZ/Z`;
- оценочный threshold;
- результаты по motion modes.

## Game statistics

Показывать:

- последний результат;
- лучший результат;
- число игр;
- средний результат;
- средний результат последних 10 игр;
- лучший результат последних 10 игр.

## Управление данными

Добавить:

- Export data;
- Clear history;
- Reset statistics.

Перед очисткой истории — подтверждение.

### Критерий готовности

- [ ] Прогресс можно понять без CSV.

---

# 4. График adaptive staircase

## График 1

Ось X: `trial number`.

Ось Y: `ΔZ/Z (%)`.

Отмечать:

- correct;
- error;
- изменение adaptive difficulty.

## График 2

Оценка:

```text
P(correct | ΔZ/Z)
```

## Threshold

Оценивать минимум:

- 75%;
- 80%;
- 90% correct.

Основная метрика:

```text
80% depth discrimination threshold
```

Пример результата:

```text
Estimated depth discrimination threshold:
ΔZ/Z ≈ 2.8% at 80% correct
```

---

# 5. Индивидуальный профиль восприятия

Постепенно перейти от одного threshold к зависимости:

```text
T(B, f, F, Z, mode)
```

где:

- `B` — baseline;
- `f` — frequency;
- `F` — focus distance;
- `Z` — mean object distance;
- `mode` — camera-motion mode.

В перспективе показывать:

```text
Best mode: Continuous
Best baseline: 9.5 cm
Best frequency: 1.4 Hz
Estimated threshold: 2.1%
```

---

# 6. Эксперимент Static vs Motion

Это один из главных исследовательских режимов.

## Протокол

Например:

```text
20 trials Static
20 trials Continuous
```

Предпочтительно — randomized interleaving.

## Контролируемые параметры

Должны совпадать:

- диапазон `Z`;
- формы;
- размеры;
- цвета;
- `ΔZ/Z`;
- расположение;
- число испытаний.

Меняется только движение камеры.

## Итог

Например:

```text
Static:
accuracy 58%
threshold 9.4%

Continuous motion parallax:
accuracy 84%
threshold 2.9%

Improvement:
+26 percentage points
```

---

# 7. Blind / randomized experiment

Цель — уменьшить влияние ожиданий пользователя.

Случайно выбирать:

- Static;
- L ↔ R;
- 5 viewpoints;
- Continuous.

Пользователь не знает текущий режим.

После блока показывать результаты по условиям.

Обеспечить одинаковое число испытаний каждого типа.

---

# 8. Automatic Experiment Mode

Добавить кнопку `Experiment`.

Программа должна автоматически исследовать:

## Motion mode

- Static;
- L ↔ R;
- 5 viewpoints;
- Continuous.

## Baseline

Пример coarse set:

```text
2, 4, 6, 8, 10, 12, 16 cm
```

## Frequency

Пример:

```text
0.5, 1.0, 1.5, 2.0, 3.0 Hz
```

Не использовать полный тупой перебор.

Стратегия:

```text
coarse scan
     ↓
best region
     ↓
fine scan
```

Пример результата:

```text
Best configuration found:
Mode: Continuous
Baseline: 9 cm
Frequency: 1.4 Hz
Focus: midpoint
Threshold: ΔZ/Z = 2.0%
```

---

# 9. Физическая калибровка экрана

Одинаковое изображение на телефоне, планшете и мониторе даёт разный визуальный угол.

Запрашивать:

- физическую ширину/диагональ экрана;
- расстояние глаз–экран.

Вычислять визуальный угол по геометрии:

```text
theta = 2 * atan((w / 2) / D)
```

Калибровку сохранять в браузере.

Это нужно для сравнения:

- между устройствами;
- между пользователями;
- между экспериментальными сессиями.

---

# 10. Calibration Mode для baseline

Цель: быстро найти рабочий baseline.

Пример:

```text
1 → 2 → 3 → 4 → 6 → 8 cm ...
```

После обнаружения диапазона — перейти к staircase/binary refinement.

Результат:

```text
Recommended starting baseline: 6.5 cm
```

---

# 11. Игра как тренажёр

Добавить уровни:

## Easy

- мало объектов;
- большой depth spread;
- большой baseline;
- сильный motion parallax.

## Normal

Средние параметры.

## Hard

- больше объектов;
- меньшие differences;
- умеренный baseline.

## Expert

- минимальные depth differences;
- высокая плотность;
- слабые подсказки.

---

# 12. Adaptive game

При хорошей игре:

- уменьшать depth differences;
- уменьшать baseline;
- уменьшать визуальные подсказки;
- увеличивать число объектов и плотность.

При ошибках — временно облегчать задачу.

Целевая точность тренировки:

```text
75–85%
```

---

# 13. Progressive hints

Текущий механизм:

- неправильная фигура → red/white;
- ближайшая → приближается;
- при приближении уменьшается так, чтобы сохранить видимый размер.

Развить:

## Ошибка 1

```text
distance × 0.8
scale × 0.8
```

## Ошибка 2

Повторить усиление подсказки.

## Ошибка 3

Кратковременно:

- увеличить baseline;
- показать trajectory cue;
- или усилить motion parallax.

Не показывать прямой ответ сразу.

---

# 14. Response time

Для каждого ответа сохранять:

```text
response_time_ms
```

Два режима могут иметь одинаковую accuracy, но разное время ответа — это важная информация.

---

# 15. Анализ по расстоянию

Разбить `Z` на группы, например:

```text
2.5–3.5 m
3.5–5.0 m
5.0–6.5 m
6.5–8.0 m
```

Оценивать threshold отдельно.

---

# 16. Анализ по baseline

Строить:

```text
threshold vs baseline
```

И искать индивидуальный оптимум.

---

# 17. Анализ по frequency

Строить:

```text
threshold vs frequency
```

И искать индивидуальный оптимум.

---

# 18. Сравнение trajectory/waveform

Сравнить:

- sine;
- triangle;
- L/R discrete;
- 5 viewpoints;
- continuous.

Позднее:

- smoothstep;
- asymmetric motion;
- random micro-motion.

---

# 19. Research Mode

В обычном режиме интерфейс должен оставаться простым.

В Research Mode показывать:

- точные параметры;
- trial number;
- random seed;
- staircase state;
- raw data;
- psychometric fit;
- confidence intervals.

---

# 20. Reproducible sessions

Каждая экспериментальная сессия должна иметь:

```text
session_id
random_seed
timestamp
protocol_version
```

Это позволит воспроизводить наборы trials.

---

# 21. Экспорт данных

Поддержать:

## CSV

Для Excel / Python / R.

## JSON

Для полного восстановления состояния и эксперимента.

## Summary

Например:

```text
Participant session
Date
Device
Viewing distance
Best mode
Best baseline
Best frequency
Estimated threshold
Static vs Motion improvement
```

---

# 22. Импорт данных

Позволить загрузить ранее экспортированный JSON:

- перенос между браузерами;
- продолжение истории;
- передача исследователю.

---

# 23. Privacy-first

По умолчанию:

> Все данные хранятся только локально в браузере.

Никакой серверной отправки без отдельного явного действия пользователя.

---

# 24. Дополнительные игровые метрики

Добавить:

- accuracy;
- reaction time;
- streak;
- best streak;
- average mistakes per scene;
- number of hints;
- final difficulty.

---

# 25. Training progress

Показывать периоды:

```text
Today
7 days
30 days
All time
```

Например:

```text
Depth threshold
Week 1: 5.4%
Week 2: 4.2%
Week 3: 3.1%
```

---

# 26. Session Mode

Готовые тренировочные сессии:

```text
5 min
10 min
20 min
```

Автоматически чередовать:

- игру;
- тест;
- отдых.

---

# 27. Контроль лишних monocular cues

В Research Mode систематически контролировать:

- angular size;
- brightness;
- color;
- texture;
- perspective cues;
- overlap;
- vertical position.

Цель:

> Motion parallax должен быть главным изменяемым признаком.

---

# 28. Texture experiment

Сравнить:

- solid;
- squares;
- triangles;
- checker;
- random texture.

Проверить, улучшает ли текстура depth discrimination.

---

# 29. Texture density

Добавить уровни:

```text
coarse
medium
fine
```

Изучить влияние spatial frequency рисунка.

---

# 30. Mobile quality

Проверять отдельно:

- Android portrait;
- Android landscape;
- iPhone portrait;
- tablet;
- desktop.

Критерии:

- viewer никогда не исчезает;
- controls не перекрывают сцену;
- основные controls не требуют обязательной прокрутки;
- игровые targets удобно нажимать пальцем;
- графики читаемы.

---

# 31. UI sanity checks

После resize/orientation change проверять минимум:

```text
viewer width > 0
viewer height > 0
canvas width > 0
canvas height > 0
```

---

# 32. Performance

Следить за:

- FPS;
- geometry count;
- texture count;
- WebGL resource disposal;
- GPU load.

Цели на смартфоне:

```text
target ≥ 30 FPS
preferred ≥ 50 FPS
```

---

# 33. Low-performance mode

При низком FPS автоматически:

- уменьшать pixel ratio;
- упрощать geometry;
- снижать anisotropy;
- уменьшать число объектов.

---

# 34. About / Method

Добавить раздел с объяснением:

- stereopsis;
- monocular motion parallax;
- temporal presentation;
- цели теста;
- роли игры как тренажёра.

---

# 35. Research Notes

Кратко описать идею:

```text
L → L½ → C → R½ → R → ...
```

и концепцию:

```text
spatial disparity
→ temporal disparity
→ motion parallax
```

---

# 36. Reproducible URL parameters

Создавать ссылки вида:

```text
?mode=continuous
&baseline=8
&frequency=1.6
&fov=55
&focus=5
```

Чтобы другой человек мог открыть те же параметры.

---

# 37. Presets

Добавить:

```text
Demo
Strong effect
Natural
Research
Training
```

---

# 38. Confidence intervals

Для threshold показывать не только одно число, но и неопределённость:

```text
2.8%
95% CI: 2.2–3.5%
```

---

# 39. Минимальный объём данных

Не показывать слишком уверенный threshold после нескольких trials.

Например:

```text
< 20 trials   → Preliminary estimate
20–50 trials  → Moderate confidence
> 50 trials   → Stable estimate
```

---

# 40. Сравнение с собственной историей

Например:

```text
Current threshold: 2.7%
30-day average: 3.4%
Improvement: 20.6%
```

---

# 41. Session notes

Позволить добавить короткую заметку:

```text
without glasses
tired
dark room
phone portrait
```

---

# 42. Device profile

Сохранять:

- viewport;
- pixel ratio;
- screen width/height;
- orientation;
- calibrated physical screen width;
- viewing distance.

Не собирать лишние персональные идентификаторы.

---

# 43. Data quality warnings

Помечать, но не удалять:

- слишком быстрые ответы;
- очень длинные паузы;
- подозрительно случайные серии;
- FPS drops.

Флаг:

```text
quality_warning
```

---

# 44. Pre-test / Training / Post-test

Режим исследования обучения:

```text
Pre-test
Training
Post-test
```

Сравнивать threshold до и после тренировки.

---

# 45. Long-term training experiment

Например:

```text
Day 1
Day 3
Day 7
Day 14
Day 30
```

Проверять, сохраняется ли эффект обучения.

---

# 46. Personal report

Автоматически формировать отчёт, например:

```text
Monocular Motion Parallax Report

Sessions: 12
Trials: 840
Games: 35

Best motion mode: Continuous
Best baseline: 8–10 cm
Best frequency: 1.2–1.7 Hz
80% depth threshold: 2.4%
Static threshold: 8.7%
Motion improvement: 72%
Training improvement over 14 days: 31%
```

---

# 47. Приоритеты

## Priority A — ближайшие задачи

- [ ] Рефакторинг `app.js`.
- [ ] Создать `storage.js`.
- [ ] Сохранять UI/camera settings.
- [ ] Сохранять последний game score.
- [ ] Сохранять game history.
- [ ] Сохранять test trial history.
- [ ] Добавить Statistics panel.
- [ ] Добавить график `ΔZ/Z`.
- [ ] Добавить threshold estimation.
- [ ] Реализовать Static vs Continuous experiment.

## Priority B — следующий уровень

- [ ] Randomized/blind experiment.
- [ ] Experiment Mode.
- [ ] Screen calibration.
- [ ] Response time.
- [ ] Game difficulty levels.
- [ ] Adaptive game.
- [ ] Progressive hints.
- [ ] Training history.

## Priority C — исследовательский уровень

- [ ] Psychometric fitting.
- [ ] Confidence intervals.
- [ ] Device calibration.
- [ ] Session IDs.
- [ ] Random seeds.
- [ ] JSON export/import.
- [ ] Research Mode.
- [ ] Personal report.

## Priority D — дальнейшие исследования

- [ ] Texture experiments.
- [ ] Frequency optimization.
- [ ] Baseline optimization.
- [ ] Long-term training protocol.
- [ ] Pre/post experiments.
- [ ] Cross-device comparison.

---

# 48. Рекомендуемый порядок непосредственной реализации

```text
[ ] 1. Разделить app.js на модули
[ ] 2. Создать storage.js
[ ] 3. Сохранять все UI/camera settings
[ ] 4. Сохранять last game score
[ ] 5. Сохранять game history
[ ] 6. Сохранять test trial history
[ ] 7. Добавить Statistics panel
[ ] 8. Добавить график adaptive staircase
[ ] 9. Добавить response time
[ ] 10. Оценивать ΔZ/Z threshold
[ ] 11. Добавить Static vs Continuous protocol
[ ] 12. Добавить randomized experiment
[ ] 13. Добавить Experiment button
[ ] 14. Автоматический поиск baseline
[ ] 15. Автоматический поиск frequency
[ ] 16. Добавить screen calibration
[ ] 17. Добавить game difficulty levels
[ ] 18. Добавить adaptive training
[ ] 19. Добавить progressive hints
[ ] 20. Добавить training progress
[ ] 21. Добавить JSON export/import
[ ] 22. Добавить Research Mode
[ ] 23. Добавить reproducible URL parameters
[ ] 24. Добавить personal report
[ ] 25. Провести первые полноценные экспериментальные серии
```

---

# 49. Главное правило развития

Каждую новую функцию оценивать вопросом:

> **Помогает ли она лучше измерить, обучить или понять monocular depth perception?**

Если нет — её приоритет ниже.

Главная ценность проекта — не количество визуальных эффектов, а возможность количественно ответить:

> **Насколько motion parallax улучшает восприятие глубины и какие параметры дают максимальный эффект для конкретного пользователя?**

---

# 50. Определение готового исследовательского прототипа

Проект можно считать полноценным research prototype, когда он умеет:

- [ ] воспроизводимо задавать параметры камеры;
- [ ] проводить blind trials;
- [ ] измерять accuracy и reaction time;
- [ ] оценивать psychometric threshold;
- [ ] сравнивать Static и Motion;
- [ ] сохранять результаты;
- [ ] экспортировать raw data;
- [ ] сохранять device/calibration info;
- [ ] строить графики;
- [ ] выдавать итоговый отчёт.

После этого ссылку можно отправлять исследователю уже не только как демонстрацию идеи, а как работающий экспериментальный инструмент.
