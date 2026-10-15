# Zen Browser — контекст для Codex: пользовательские CSS-анимации

## Цель

Настроить собственные анимации и подсветки интерфейса **Zen Browser** через `userChrome.css` (Firefox/Zen, не CSS веб-сайтов).

**Текущая приоритетная задача:** сделать **видимое голубо-фиолетовое свечение вокруг плавающей адресной строки при Ctrl+T / Ctrl+L**. Не просто смену её заливки. Пользователь хочет эффект, заметный сразу, с плавной анимацией. Желательно сохранить уже работающую анимацию вкладок.

## Что уже сделано

- Используется `userChrome.css` в каталоге `chrome` активного профиля Zen.
- В `about:config` включён `toolkit.legacyUserProfileCustomizations.stylesheets = true`.
- Пользователь подтвердил, что кастомный CSS **загружается и применяется**.
- После изменений браузер перезапускается.
- ОС, точная версия Zen и набор других модов не подтверждены; не предполагать их без проверки.

## Проверенные результаты

1. **Первый тестовый CSS для вкладок работал**: при наведении вкладка смещалась, масштабировалась и подсвечивалась.
2. Большой набор `Zen Neon Flow` работал частично: некоторые эффекты на вкладках не появились с первого раза.
3. Более поздняя подсветка **активной вкладки в левой боковой панели заработала**. Это уже решено.
4. Для адресной строки первоначальный селектор `#urlbar-background` не дал нужного эффекта.
5. После перехода на `.urlbar-background` **заливка адресной строки изменилась**, то есть новый селектор действительно находит и стилизует нужный элемент.
6. Однако `box-shadow` вокруг адресной строки **не виден**, даже если анимация/заливка применяются.
7. Последним предложением был тест через `outline` и `inset box-shadow`; **результат этого последнего варианта пользователь ещё не сообщал**. Нельзя утверждать, что он сработал или не сработал.

## Рабочий первый пример анимации вкладок

Этот CSS пользователь проверил и подтвердил, что он работает:

```css
.tabbrowser-tab {
  transition:
    transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 300ms ease !important;
}

.tabbrowser-tab:hover {
  transform: translateX(7px) scale(1.03) !important;
  filter: brightness(1.25) !important;
}

.tabbrowser-tab:hover .tab-background {
  background-color: rgba(70, 150, 255, 0.35) !important;
  outline: 2px solid rgba(100, 170, 255, 0.8) !important;
  border-radius: 9px !important;
}
```

## Подсветка активной вкладки — вариант, после которого пользователь подтвердил успех

```css
@keyframes zen-active-neon {
  0%, 100% {
    box-shadow:
      inset 0 0 0 2px #62c6ff,
      0 0 5px rgba(98, 198, 255, 0.25);
  }
  50% {
    box-shadow:
      inset 0 0 0 2px #a78bfa,
      0 0 15px rgba(167, 139, 250, 0.55);
  }
}

#tabbrowser-tabs
.tabbrowser-tab:is([selected], [visuallyselected])
.tab-background {
  border-radius: 10px !important;
  background: linear-gradient(
    110deg,
    rgba(98, 198, 255, 0.16),
    rgba(167, 139, 250, 0.22)
  ) !important;
  animation: zen-active-neon 2.5s ease-in-out infinite !important;
}

#tabbrowser-tabs .tabbrowser-tab .tab-background {
  transition: background 300ms ease, box-shadow 300ms ease !important;
}

#tabbrowser-tabs
.tabbrowser-tab:not([selected]):not([visuallyselected])
.tab-background {
  animation: none !important;
}
```

## Попытка подсветки строки: заливка менялась, свечение не появилось

```css
@keyframes zen-url-neon {
  0%, 100% {
    box-shadow:
      0 0 12px rgba(98, 198, 255, 0.5),
      0 0 28px rgba(98, 198, 255, 0.2),
      inset 0 0 0 2px #62c6ff;
  }
  50% {
    box-shadow:
      0 0 24px rgba(167, 139, 250, 0.7),
      0 0 50px rgba(167, 139, 250, 0.3),
      inset 0 0 0 2px #a78bfa;
  }
}

#urlbar[breakout-extend] .urlbar-background {
  border-radius: 14px !important;
  animation: zen-url-neon 2.5s ease-in-out infinite !important;
}

#urlbar[open] .urlbar-background {
  background-color: rgba(25, 27, 45, 0.97) !important;
}
```

**Наблюдение:** пользователь прямо сообщил: «Она заливку поменяла, свечение не появилось».

## Самая последняя предложенная (ещё не проверенная) версия

```css
@keyframes zen-glow-pulse {
  0%, 100% {
    outline-color: #62c6ff;
    outline-offset: 2px;
    box-shadow: inset 0 0 14px rgba(98, 198, 255, 0.35);
  }
  50% {
    outline-color: #c084fc;
    outline-offset: 5px;
    box-shadow: inset 0 0 22px rgba(192, 132, 252, 0.55);
  }
}

#urlbar[breakout-extend="true"] .urlbar-background {
  border-radius: 14px !important;
  border: 2px solid #62c6ff !important;
  outline: 3px solid #62c6ff !important;
  outline-offset: 2px !important;
  animation: zen-glow-pulse 2s ease-in-out infinite !important;
}

#urlbar[breakout-extend="true"] .urlbar-background {
  background-color: revert !important;
}
```

## Гипотезы для диагностики (не установленные факты)

- Наружная тень `.urlbar-background` обрезается `overflow` у предков либо перекрывается соседними слоями.
- Свечение нужно рисовать на другом контейнере или псевдоэлементе, либо использовать `filter: drop-shadow()` на подходящем предке.
- Возможно, `#urlbar[breakout-extend="true"]` не совпадает с фактическими атрибутами в конкретной версии, хотя более широкий `#urlbar[breakout-extend]` уже применялся.
- Возможен конфликт с темой / Zen Mods / встроенными правилами `!important`.

## Что нужно сделать Codex

1. Сначала ознакомиться с текущим содержимым `userChrome.css`, если файл предоставлен; **не перезаписывать другие работающие стили**.
2. Выяснить актуальную DOM-структуру плавающей адресной строки конкретной версии Zen, по возможности через **Browser Toolbox** (`Ctrl+Shift+Alt+I`, если включены соответствующие параметры Firefox) и инспектор; не гадать с селекторами.
3. Проверить `computed style`, перекрытия, `overflow`, `box-shadow`, `outline`, применимость атрибутов состояния строки.
4. Сделать один минимальный диагностический CSS с заведомо видимой рамкой и затем отдельный окончательный аккуратный эффект свечения вокруг всей строки.
5. Учитывать `prefers-reduced-motion`, минимизировать влияние на работу поиска, фокус и кликабельность.
6. Дать точные инструкции, куда вставить CSS, какие старые конфликтующие блоки удалить, и как проверить после перезапуска.
7. Не выдавать гипотезы о селекторах и версии Zen за проверенные факты.

## Другие идеи пользователя

Пользователь интересуется анимациями появления вкладок, открывания папок, боковой панели и поиска. Но сейчас приоритет — рабочее **наружное свечение плавающей строки поиска**; анимация активных вкладок слева уже есть.
