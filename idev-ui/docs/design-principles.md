# iDev Design Principles

Обязательные правила для всех iDev продуктов.

---

## Навигация / Header

**Хедер НЕ должен быть sticky/fixed.** Он скроллится вместе со страницей и уходит вверх.

```css
/* ✅ Правильно */
.header {
    position: relative;
    background: var(--bg);
    padding: 16px 20px 12px;
}

/* ❌ Неправильно */
.header {
    position: sticky;  /* или fixed */
    top: 0;
}
```

**Почему:** Sticky хедер занимает место на экране, мешает восприятию контента и раздражает при скролле. Пользователь сам вернётся наверх если нужно.

**Применяется везде:** idev-website, idev-hr, idev-hr-demo, ess, все будущие проекты.

---

## Тема / Theme

- Поддержка тёмной и светлой темы через `[data-theme]` на `<html>`
- Токены из `idev-ui/tokens/tokens.css` — единственный источник цветов
- ThemeToggle кнопка всегда в правой части хедера

## Цвета

- Акцент: `#fd7448` (оранжевый) — кнопки, активные состояния, ссылки
- Активные фильтры/таги: `bg-[var(--accent)] text-white`
- Скиллы/теги: `bg-[var(--accent-soft)] text-[var(--accent)]`

## Шрифт

- Montserrat (latin + cyrillic) — единственный брендовый шрифт
