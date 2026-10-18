import { listBooks, putBook, getBook, deleteBook, getProgress, putProgress,
    journalProgress, readSettings, writeSettings } from './storage.js';
import { describeBook, openBookFile, isBookFile, formatSize, percent } from './books.js';
import { makeBackup, restoreBackup } from './backup.js';

// Book documents may only render inside the reader; never run this UI inside a book.
if (window.top !== window.self) throw new Error('Reader UI cannot run inside a book.');
const $ = selector => document.querySelector(selector);
const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};
const settings = { fontSize: 20, font: 'serif', flow: 'paginated', theme: 'paper', ...readSettings() };
settings.fontSize = Math.max(14, Math.min(32, Number(settings.fontSize) || 20));
if (!['serif', 'sans'].includes(settings.font)) settings.font = 'serif';
if (!['paginated', 'scrolled'].includes(settings.flow)) settings.flow = 'paginated';
if (!['paper', 'sepia', 'dark'].includes(settings.theme)) settings.theme = 'paper';
let books = [], positions = new Map(), coverURLs = [], view, current, canSave = false;
let busy = false, pending, saveTimer, toastTimer, saveChain = Promise.resolve(), returnCFI;

function notify(message, error = false) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').classList.toggle('error', error);
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => $('#toast').hidden = true, error ? 10000 : 5000);
}
function report(error) {
    console.error(error);
    notify(error?.name === 'QuotaExceededError' ? 'На устройстве не хватает места. Сохраните копию библиотеки и удалите ненужные книги.'
        : error?.message || 'Не удалось выполнить действие.', true);
}
const action = fn => async (...args) => { try { await fn(...args); } catch (error) { report(error); } };
async function working(text, fn) {
    if (busy) return;
    busy = true; $('#busy-text').textContent = text; $('#busy').hidden = false;
    try { return await fn(); }
    finally { busy = false; $('#busy').hidden = true; }
}

function cover(book) {
    const node = el('div', 'cover');
    const colors = ['#526550', '#8c6651', '#586e77', '#8a784c', '#6b5d72'];
    node.style.setProperty('--cover', colors[parseInt(book.id.slice(0, 2), 16) % colors.length]);
    if (book.cover) {
        const image = el('img'); image.alt = ''; image.loading = 'lazy';
        const url = URL.createObjectURL(book.cover); coverURLs.push(url); image.src = url;
        node.append(image);
    } else {
        const placeholder = el('div', 'cover-placeholder');
        placeholder.append(el('i', 'cover-line'), el('strong', '', book.title), el('span', '', book.format));
        node.append(placeholder);
    }
    return node;
}
function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a'); a.href = url; a.download = name; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function confirmDelete(book) {
    return new Promise(resolve => {
        const dialog = $('#help-dialog');
        $('#help-title').textContent = 'Убрать книгу с полки?';
        $('#help-message').textContent = `«${book.title}» и её место чтения будут удалены из этого браузера. Исходный файл останется у вас.`;
        const finish = value => { dialog.close(); cleanup(); resolve(value); };
        const ok = () => finish(true), cancel = () => finish(false);
        const cleanup = () => {
            $('#help-confirm').removeEventListener('click', ok);
            $('#help-cancel').removeEventListener('click', cancel);
            dialog.removeEventListener('cancel', cancel);
            dialog.removeEventListener('close', cancel);
        };
        $('#help-confirm').addEventListener('click', ok);
        $('#help-cancel').addEventListener('click', cancel);
        dialog.addEventListener('cancel', cancel, { once: true });
        dialog.addEventListener('close', cancel, { once: true });
        dialog.showModal();
    });
}
function renderLibrary() {
    coverURLs.forEach(URL.revokeObjectURL); coverURLs = [];
    const query = $('#search').value.toLocaleLowerCase().trim();
    const sorted = [...books].sort((a, b) => (positions.get(b.id)?.updated || b.added) - (positions.get(a.id)?.updated || a.added));
    $('#count').textContent = books.length;
    $('#empty').hidden = books.length > 0;
    $('#export').disabled = !books.length;
    $('#books').replaceChildren();
    const filtered = sorted.filter(book => `${book.title} ${book.author}`.toLocaleLowerCase().includes(query));
    $('#no-results').hidden = !books.length || filtered.length > 0;
    for (const book of filtered) {
        const position = positions.get(book.id);
        const card = el('article', 'book-card');
        const open = el('button', 'open-book');
        open.title = `Читать «${book.title}»`;
        open.addEventListener('click', action(() => read(book.id)));
        open.append(cover(book), el('h3', 'book-title', book.title), el('p', 'book-author', book.author || 'Автор не указан'));
        const meta = el('div', 'book-meta'); const progress = el('progress');
        progress.max = 1; progress.value = position?.fraction || 0;
        progress.setAttribute('aria-label', 'Прочитано ' + percent(progress.value));
        meta.append(el('span', '', book.format), progress, el('span', '', position ? percent(position.fraction) : 'Новое'));
        const actions = el('div', 'book-actions');
        const original = el('button', '', 'Скачать'); original.title = `Исходный файл · ${formatSize(book.size)}`;
        original.addEventListener('click', () => download(book.data, book.name));
        const remove = el('button', '', 'Удалить'); remove.setAttribute('aria-label', `Удалить «${book.title}»`);
        remove.addEventListener('click', action(async () => {
            if (await confirmDelete(book)) { await deleteBook(book.id); await refresh(); }
        }));
        actions.append(original, remove); card.append(open, meta, actions); $('#books').append(card);
    }
    const last = sorted.find(book => positions.has(book.id));
    const continuation = $('#continue'); continuation.hidden = !last; continuation.replaceChildren();
    if (last) {
        const p = positions.get(last.id), info = el('div', 'continue-info');
        info.append(el('p', 'eyebrow', 'ПРОДОЛЖИТЬ ЧТЕНИЕ'), el('h2', '', last.title),
            el('p', '', last.author), el('p', '', `${percent(p.fraction)} прочитано${p.chapter ? ' · ' + p.chapter : ''}`));
        const resume = el('button', '', 'Продолжить →'); resume.addEventListener('click', action(() => read(last.id)));
        continuation.append(cover(last), info, resume);
    }
}
async function refresh() {
    books = await listBooks();
    positions = new Map(await Promise.all(books.map(async book => [book.id, await getProgress(book.id)])));
    positions = new Map([...positions].filter(([, p]) => p));
    renderLibrary();
}

async function importFiles(files) {
    const input = [...files];
    if (!input.length) return;
    if (input.length > 100) throw new Error('Добавляйте не больше 100 книг за один раз.');
    await working('Добавляем книги…', async () => {
        let added = 0, duplicates = 0; const errors = [];
        for (const [i, file] of input.entries()) {
            $('#busy-text').textContent = `Добавляем ${i + 1} из ${input.length}: ${file.name}`;
            try {
                if (!isBookFile(file.name)) throw new Error('нужен EPUB, FB2 или FB2.ZIP');
                const book = await describeBook(file);
                if (await getBook(book.id)) duplicates++;
                else { await putBook(book); added++; }
            } catch (error) { console.error(error); errors.push(`${file.name}: ${error.message}`); }
        }
        await refresh();
        if (added) navigator.storage?.persist?.().catch(() => {});
        notify(`Добавлено: ${added}.${duplicates ? ` Уже на полке: ${duplicates}.` : ''}${errors.length ? ` Ошибки: ${errors.join('; ')}` : ''}`, errors.length > 0);
    });
}

function onRelocate(detail) {
    $('#percent').textContent = percent(detail.fraction);
    $('#progress').value = detail.fraction || 0;
    $('#chapter').textContent = detail.tocItem?.label || '';
    if (!canSave || !current || !detail.cfi) return;
    pending = { id: current.id, cfi: detail.cfi, fraction: detail.fraction || 0,
        chapter: detail.tocItem?.label || '', updated: Date.now() };
    positions.set(current.id, pending);
    journalProgress(pending);
    $('#save-state').textContent = 'Сохраняем место…';
    clearTimeout(saveTimer); saveTimer = setTimeout(() => flush().catch(report), 300);
}
async function flush() {
    clearTimeout(saveTimer);
    const position = pending;
    if (!position) return saveChain;
    pending = null;
    saveChain = saveChain.catch(() => {}).then(() => putProgress(position));
    try {
        await saveChain;
        if (current?.id === position.id && !pending) $('#save-state').textContent = 'Место сохранено';
    } catch (error) {
        if (!pending) pending = position;
        $('#save-state').textContent = 'Не удалось сохранить место';
        throw error;
    }
}

function bookCSS() {
    const theme = { paper: ['#fffcf6', '#292e29', '#47634c'], sepia: ['#eee2c8', '#493c2a', '#755326'], dark: ['#222724', '#dddcd2', '#a9c5aa'] }[settings.theme];
    return `html { color-scheme: ${settings.theme === 'dark' ? 'dark' : 'light'}; background: ${theme[0]} !important; color: ${theme[1]} !important; font-size: ${settings.fontSize}px !important; }
    body { background: transparent !important; color: inherit !important; font-family: ${settings.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'system-ui, sans-serif'} !important; font-size: 1rem !important; }
    p, li, blockquote, dd { line-height: 1.65; } p { orphans: 2; widows: 2; }
    a:any-link { color: ${theme[2]} !important; } img, svg { max-width: 100%; object-fit: contain; }
    pre { white-space: pre-wrap !important; overflow-wrap: anywhere; } table { max-width: 100%; }`;
}
function applySettings() {
    $('#reader').dataset.pageTheme = settings.theme;
    $('#font-size').value = settings.fontSize; $('#font-label').textContent = settings.fontSize;
    $('#font-family').value = settings.font; $('#flow').value = settings.flow;
    document.querySelectorAll('[data-theme]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.theme === settings.theme)));
    if (view?.renderer) {
        view.renderer.setAttribute('flow', settings.flow);
        view.renderer.setAttribute('max-column-count', '1');
        view.renderer.setAttribute('max-inline-size', '760px');
        view.renderer.setAttribute('margin', '24px');
        view.renderer.setStyles?.(bookCSS());
    }
    writeSettings(settings);
}
function keyboard(event) {
    if (busy || !view || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target?.tagName)) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); action(() => view.goRight())(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); action(() => view.goLeft())(); }
    else if (event.key === ' ' || event.key === 'PageDown') { event.preventDefault(); action(() => event.shiftKey ? view.prev() : view.next())(); }
    else if (event.key === 'PageUp') { event.preventDefault(); action(() => view.prev())(); }
    else if (event.key === 'Escape') action(closeReader)();
}
function connectDocument(doc) {
    doc.addEventListener('keydown', keyboard);
    let start;
    doc.addEventListener('touchstart', event => {
        start = event.touches.length === 1 ? [event.touches[0].clientX, event.touches[0].clientY] : null;
    }, { passive: true });
    doc.addEventListener('touchend', event => {
        if (!start || settings.flow !== 'paginated' || !view || doc.getSelection()?.toString()) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - start[0], dy = touch.clientY - start[1]; start = null;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.8)
            action(() => dx < 0 ? view.goRight() : view.goLeft())();
    }, { passive: true });
}
function makeTOC(items) {
    const list = el('ol');
    for (const item of items) {
        const li = el('li'), button = el('button', '', item.label || 'Раздел');
        button.addEventListener('click', action(async () => {
            $('#toc-dialog').close(); await view.goTo(item.href);
        }));
        li.append(button);
        if (item.subitems?.length) li.append(makeTOC(item.subitems));
        list.append(li);
    }
    return list;
}
async function read(id) {
    await working('Открываем книгу…', async () => {
        await flush();
        const record = await getBook(id);
        if (!record) throw new Error('Книга не найдена.');
        const saved = await getProgress(id);
        let book;
        try {
            book = await openBookFile(new File([record.data], record.name));
            current = record; canSave = false; returnCFI = null; $('#return-position').hidden = true;
            $('#reading-title').textContent = record.title; $('#reading-author').textContent = record.author;
            document.title = `${record.title} — Полка`;
            $('#library').hidden = true; $('#reader').hidden = false;
            view = document.createElement('foliate-view'); $('#viewport').append(view);
            view.addEventListener('relocate', event => onRelocate(event.detail));
            view.addEventListener('load', event => connectDocument(event.detail.doc));
            view.addEventListener('external-link', event => {
                event.preventDefault();
                const href = event.detail.href_;
                if (/^https?:\/\//i.test(href)) window.open(href, '_blank', 'noopener,noreferrer');
            });
            view.addEventListener('link', () => {
                returnCFI = view.lastLocation?.cfi;
                $('#return-position').hidden = !returnCFI;
            });
            await view.open(book); applySettings();
            $('#toc').replaceChildren(book.toc?.length ? makeTOC(book.toc) : el('p', 'hint', 'В этой книге нет оглавления.'));
            try { await view.init({ lastLocation: saved?.cfi }); }
            catch (error) {
                // Preserve the old bookmark on disk if restoration fails.
                console.warn('CFI restore failed', error);
                if (!saved) throw error;
                await view.goToFraction(saved.fraction || 0);
                notify('Точное место не удалось восстановить; открыта ближайшая позиция.');
            }
            canSave = true;
            if (view.lastLocation) onRelocate(view.lastLocation);
            await flush();
        } catch (error) {
            canSave = false;
            try { view?.close(); } catch { /* May be only partly initialized. */ }
            view?.remove(); view = null; book?.destroy?.(); current = null;
            $('#reader').hidden = true; $('#library').hidden = false;
            document.title = 'Полка — личная библиотека';
            throw new Error(`Не удалось открыть «${record.title}». ${error.message}`);
        }
    });
}
async function closeReader() {
    if (busy || !view) return;
    await flush(); canSave = false;
    const book = view.book;
    view.close(); view.remove(); view = null; book.destroy?.(); current = null;
    $('#reader').hidden = true; $('#library').hidden = false;
    document.title = 'Полка — личная библиотека';
    await refresh(); $('#import').focus();
}

$('#import').addEventListener('click', () => $('#files').click());
$('#files').addEventListener('change', action(async event => {
    const files = [...event.target.files]; event.target.value = ''; await importFiles(files);
}));
$('#search').addEventListener('input', renderLibrary);
$('#back').addEventListener('click', action(closeReader));
$('#prev').addEventListener('click', action(() => view?.prev()));
$('#next').addEventListener('click', action(() => view?.next()));
$('#progress').addEventListener('change', action(event => view?.goToFraction(Number(event.target.value))));
$('#toc-button').addEventListener('click', () => $('#toc-dialog').showModal());
$('#settings-button').addEventListener('click', () => $('#settings-dialog').showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('#return-position').addEventListener('click', action(async () => {
    if (!returnCFI) return;
    const target = returnCFI; returnCFI = null; $('#return-position').hidden = true;
    $('#toc-dialog').close(); await view.goTo(target);
}));
$('#font-size').addEventListener('input', event => { settings.fontSize = Number(event.target.value); applySettings(); });
$('#font-family').addEventListener('change', event => { settings.font = event.target.value; applySettings(); });
$('#flow').addEventListener('change', event => { settings.flow = event.target.value; applySettings(); });
document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
    settings.theme = button.dataset.theme; applySettings();
}));
$('#export').addEventListener('click', action(() => working('Сохраняем библиотеку…', async () => {
    await flush();
    const total = books.reduce((n, book) => n + book.size, 0);
    if (total > 240 * 1024 * 1024) throw new Error('Для копирования библиотеки больше 240 МБ скачайте исходные книги по отдельности.');
    download(await makeBackup(books), `polka-${new Date().toISOString().slice(0, 10)}.zip`);
    notify('Копия подготовлена: книги и сохранённые места чтения.');
})));
$('#restore').addEventListener('click', () => $('#backup-file').click());
$('#backup-file').addEventListener('change', action(async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    await working('Восстанавливаем библиотеку…', async () => {
        const result = await restoreBackup(file, text => $('#busy-text').textContent = text);
        await refresh(); notify(`Добавлено книг: ${result.added}. Места чтения восстановлены; более новые сохранения оставлены.`);
    });
}));
$('#demo').addEventListener('click', action(async () => {
    const response = await fetch('./demo.fb2');
    if (!response.ok) throw new Error('Не удалось загрузить пример.');
    const file = new File([await response.blob()], 'Добро пожаловать.fb2');
    await importFiles([file]);
    const demo = await describeBook(file); await read(demo.id);
}));
document.addEventListener('keydown', keyboard);
let dragCounter = 0;
document.addEventListener('dragenter', event => {
    if (!event.dataTransfer?.types.includes('Files') || busy || view) return;
    dragCounter++; document.body.classList.add('dragging');
});
document.addEventListener('dragleave', () => { if (--dragCounter <= 0) document.body.classList.remove('dragging'); });
document.addEventListener('dragover', event => event.preventDefault());
document.addEventListener('drop', action(async event => {
    event.preventDefault(); dragCounter = 0; document.body.classList.remove('dragging');
    if (!view) await importFiles(event.dataTransfer.files);
}));
function saveOnLeave() {
    if (pending) journalProgress(pending);
    flush().catch(error => console.error('Position save:', error));
}
document.addEventListener('visibilitychange', () => { if (document.hidden) saveOnLeave(); });
window.addEventListener('pagehide', saveOnLeave);
window.addEventListener('beforeunload', saveOnLeave);
window.addEventListener('pageshow', () => { if (!view) action(refresh)(); });

applySettings();
try {
    await refresh();
    if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        const updateOffline = () => {
            $('#offline-state').textContent = registration.active ? 'Готово к чтению без интернета.' : 'Подготавливаем чтение без интернета…';
        };
        updateOffline();
        registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', updateOffline));
        navigator.serviceWorker.addEventListener('controllerchange', updateOffline);
    }
} catch (error) {
    report(error);
    $('#offline-state').textContent = 'Не удалось подготовить хранилище или офлайн-режим. Попробуйте обычную вкладку браузера.';
}
