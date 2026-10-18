import { zipSync, unzipSync, strToU8, strFromU8 } from './vendor/fflate.js';
import { describeBook, MAX_BOOK_BYTES } from './books.js';
import { getProgress, getBook, putBook, putProgress, journalProgress } from './storage.js';

export async function makeBackup(books) {
    const entries = {};
    const manifest = { application: 'polka', version: 1, created: new Date().toISOString(), books: [] };
    for (const [index, book] of books.entries()) {
        const path = `books/${index}.${book.format === 'EPUB' ? 'epub' : 'fb2'}`;
        entries[path] = new Uint8Array(await book.data.arrayBuffer());
        manifest.books.push({ path, name: book.name, progress: await getProgress(book.id) ?? null });
    }
    entries['polka.json'] = strToU8(JSON.stringify(manifest));
    return new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' });
}

export async function restoreBackup(file, onProgress = () => {}) {
    if (!file.size || file.size > 256 * 1024 * 1024) throw new Error('Резервная копия должна быть не больше 256 МБ.');
    let expanded = 0;
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter(entry) {
        expanded += entry.originalSize;
        if (entry.originalSize > MAX_BOOK_BYTES || expanded > 384 * 1024 * 1024)
            throw new Error('Слишком большой распакованный архив.');
        return !entry.name.endsWith('/');
    } });
    if (!entries['polka.json'] || entries['polka.json'].length > 4 * 1024 * 1024) throw new Error('Это не резервная копия Полки.');
    const manifest = JSON.parse(strFromU8(entries['polka.json']));
    if (manifest.application !== 'polka' || manifest.version !== 1 || !Array.isArray(manifest.books) || manifest.books.length > 1000)
        throw new Error('Неизвестный формат резервной копии.');
    // Validate every book before changing the user's library.
    const prepared = [], seen = new Set();
    for (const [index, item] of manifest.books.entries()) {
        if (typeof item.path !== 'string' || typeof item.name !== 'string' || !entries[item.path])
            throw new Error('В резервной копии отсутствует файл книги.');
        if (seen.has(item.path)) throw new Error('В резервной копии повторяется путь файла.');
        seen.add(item.path);
        onProgress(`Проверяем книгу ${index + 1} из ${manifest.books.length}…`);
        const book = await describeBook(new File([entries[item.path]], item.name));
        const progress = item.progress;
        const valid = progress && typeof progress.cfi === 'string' && progress.cfi.startsWith('epubcfi(')
            && progress.cfi.length < 10000 && Number.isFinite(progress.updated) && Number.isFinite(progress.fraction);
        prepared.push({ book, progress: valid ? { id: book.id, cfi: progress.cfi,
            fraction: Math.max(0, Math.min(1, progress.fraction)), updated: progress.updated,
            chapter: typeof progress.chapter === 'string' ? progress.chapter : '' } : null });
    }
    let count = 0;
    for (const { book, progress } of prepared) {
        if (!await getBook(book.id)) { await putBook(book); count++; }
        const current = await getProgress(book.id);
        if (progress && progress.updated > (current?.updated ?? 0)) {
            await putProgress(progress); journalProgress(progress);
        }
    }
    return { added: count, total: prepared.length };
}
