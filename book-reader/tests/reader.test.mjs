import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { indexedDB } from 'fake-indexeddb';

const dom = new JSDOM(await readFile(new URL('../index.html', import.meta.url), 'utf8'), {
    url: 'https://miniapps.example/book-reader/', pretendToBeVisual: true,
});
for (const key of ['window', 'document', 'HTMLElement', 'customElements', 'DOMParser', 'XMLSerializer',
    'Node', 'NodeFilter', 'Range', 'ProcessingInstruction', 'Event', 'EventTarget', 'CustomEvent', 'localStorage'])
    globalThis[key] = dom.window[key];
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.indexedDB = indexedDB;
// Keep native File/Blob/URL/streams, which implement arrayBuffer and blob URLs.
const storage = await import('../storage.js');
const books = await import('../books.js');
const CFI = await import('../vendor/foliate/epubcfi.js');
const { makeBackup, restoreBackup } = await import('../backup.js');
const { zipSync, strToU8 } = await import('../vendor/fflate.js');
const demo = new File([await readFile(new URL('../demo.fb2', import.meta.url))], 'sample.FB2');
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSioAAAAASUVORK5CYII=', 'base64'));
function epubFile() {
    const entries = {
        mimetype: strToU8('application/epub+zip'),
        'META-INF/container.xml': strToU8('<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
        'OPS/package.opf': strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">reader-test</dc:identifier><dc:title>EPUB с иллюстрацией</dc:title><dc:creator>Тестовый автор</dc:creator><dc:language>ru</dc:language></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/><item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'),
        'OPS/nav.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Оглавление</title></head><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">Первая глава</a></li><li><a href="c2.xhtml">Вторая глава</a></li></ol></nav></body></html>'),
        'OPS/c1.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Глава 1</title><script>parent.__unsafe=true</script></head><body onload="alert(1)"><h1>Первая глава</h1><p id="one">Привет, читатель!</p><img src="cover.png" alt="Иллюстрация"/><a href="javascript:alert(1)">Плохая ссылка</a><form action="https://example.org"><input/></form></body></html>'),
        'OPS/c2.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Глава 2</title></head><body><h1>Вторая глава</h1><p id="two">Текст для восстановления позиции.</p></body></html>'),
        'OPS/cover.png': png,
    };
    return new File([zipSync(entries)], 'sample.EPUB');
}
async function clear() {
    for (const book of await storage.listBooks()) await storage.deleteBook(book.id);
    localStorage.clear();
}
function textCFI(book, index, doc) {
    const text = doc.querySelector('p').firstChild;
    const range = doc.createRange(); range.setStart(text, 2); range.setEnd(text, 6);
    const base = book.sections[index].cfi ?? CFI.fake.fromIndex(index);
    return CFI.joinIndir(base, CFI.fromRange(range));
}

test('FB2: metadata, embedded image, chapters, notes, stable text CFI', async () => {
    const description = await books.describeBook(demo);
    assert.equal(description.title, 'Небольшая книга о чтении');
    assert.equal(description.author, 'Полка');
    assert.equal(description.format, 'FB2');
    const book = await books.openBookFile(demo);
    assert.equal(book.sections.length, 5);
    const doc = book.sections[0].createDocument();
    assert.match(doc.querySelector('img').getAttribute('src'), /^data:image\/svg\+xml;base64,/);
    const cfi = textCFI(book, 1, book.sections[1].createDocument());
    const view = Object.create((await import('../vendor/foliate/view.js')).View.prototype);
    view.book = book;
    const resolved = view.resolveCFI(cfi);
    assert.equal(resolved.index, 1);
    const restored = resolved.anchor(book.sections[1].createDocument());
    assert.equal(restored.toString(), 'бума');
    assert.equal(book.resolveHref('#note1').index, 4);
    book.destroy();
});

test('FB2.ZIP: directory entries and uppercase inner filename are accepted', async () => {
    const archive = new File([zipSync({ 'content/BOOK.FB2': new Uint8Array(await demo.arrayBuffer()) })], 'book.FB2.ZIP');
    const record = await books.describeBook(archive);
    assert.equal(record.title, 'Небольшая книга о чтении');
    assert.equal(record.format, 'FB2');
    await assert.rejects(books.describeBook(new File([zipSync({ 'readme.txt': strToU8('No book') })], 'bad.fb2.zip')), /не найден/);
});

test('EPUB: decompression, metadata, cover, image rewriting and active-content removal', async () => {
    const record = await books.describeBook(epubFile());
    assert.equal(record.title, 'EPUB с иллюстрацией');
    assert.equal(record.author, 'Тестовый автор');
    assert.equal(record.cover.type, 'image/png');
    assert.equal(record.cover.size, png.length);
    const book = await books.openBookFile(epubFile());
    assert.equal(book.sections.length, 2);
    assert.equal(book.toc[1].label, 'Вторая глава');
    const url = await book.sections[0].load();
    const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'application/xhtml+xml');
    assert.equal(doc.querySelector('script, form, input, [onload]'), null);
    assert.equal(doc.querySelector('a').hasAttribute('href'), false);
    assert.match(doc.querySelector('img').getAttribute('src'), /^blob:/);
    const doc2 = await book.sections[1].createDocument();
    const cfi = textCFI(book, 1, doc2);
    const restored = book.resolveCFI(cfi);
    assert.equal(restored.index, 1);
    assert.equal(restored.anchor(await book.sections[1].createDocument()).toString(), 'кст ');
    book.destroy();
});

test('storage: binary file survives reopen; synchronous journal wins after a stopped write', async () => {
    await clear();
    const record = await books.describeBook(demo); await storage.putBook(record);
    const restored = await storage.getBook(record.id);
    assert.equal(await restored.data.text(), await demo.text());
    assert.equal(await books.fileID(new File([demo], 'renamed.fb2')), record.id);
    await storage.putProgress({ id: record.id, cfi: 'epubcfi(/6/2)', fraction: .1, updated: 1 });
    storage.journalProgress({ id: record.id, cfi: 'epubcfi(/6/4)', fraction: .6, updated: 2 });
    assert.equal((await storage.getProgress(record.id)).fraction, .6);
    localStorage.removeItem('polka-position:' + record.id);
    assert.equal((await storage.getProgress(record.id)).fraction, .1);
    await clear();
});

test('backup roundtrip preserves original FB2, compressed FB2, EPUB and their progress; merge keeps newer progress', async () => {
    await clear();
    const zipped = new File([zipSync({ 'book.fb2': new Uint8Array(await demo.arrayBuffer()) })], 'book.fb2.zip');
    const input = [demo, zipped, epubFile()];
    const records = await Promise.all(input.map(books.describeBook));
    for (const [i, record] of records.entries()) {
        await storage.putBook(record);
        await storage.putProgress({ id: record.id, cfi: 'epubcfi(/6/2)', fraction: .2 * (i + 1), chapter: 'Глава', updated: 100 + i });
    }
    const backup = await makeBackup(await storage.listBooks());
    await clear();
    const result = await restoreBackup(backup);
    assert.equal(result.added, 3);
    for (const [i, record] of records.entries()) {
        assert.equal(await books.fileID((await storage.getBook(record.id)).data), record.id);
        assert.equal((await storage.getProgress(record.id)).fraction, .2 * (i + 1));
    }
    await storage.putProgress({ id: records[0].id, cfi: 'epubcfi(/6/4)', fraction: .9, updated: 999 });
    assert.equal((await restoreBackup(backup)).added, 0);
    assert.equal((await storage.getProgress(records[0].id)).fraction, .9);
    await assert.rejects(restoreBackup(new Blob(['not a zip'])));
    assert.equal((await storage.listBooks()).length, 3);
    await clear();
});

test('invalid backup validates all entries before importing any book', async () => {
    const blob = new Blob([zipSync({ 'polka.json': strToU8(JSON.stringify({ application: 'polka', version: 1,
        books: [{ name: 'valid.fb2', path: 'a' }, { name: 'bad.fb2', path: 'missing' }] })),
        a: new Uint8Array(await demo.arrayBuffer()) })]);
    await assert.rejects(restoreBackup(blob), /отсутствует/);
    assert.equal((await storage.listBooks()).length, 0);
});

test('DOM integration: import, duplicate detection, reader restore and library return (pagination mocked)', async () => {
    // This verifies application wiring without claiming browser/layout coverage.
    const { View } = await import('../vendor/foliate/view.js');
    let initial;
    View.prototype.open = async function (book) {
        this.book = book;
        this.renderer = { setAttribute() {}, setStyles() {}, destroy() {}, remove() {} };
    };
    View.prototype.init = async function ({ lastLocation }) {
        initial = lastLocation;
        this.lastLocation = { cfi: lastLocation || 'epubcfi(/6/2)', fraction: .42, tocItem: { label: 'Глава' } };
        this.dispatchEvent(new CustomEvent('relocate', { detail: this.lastLocation }));
    };
    View.prototype.close = function () {};
    await import('../app.js');
    const wait = async check => {
        for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(r => setTimeout(r, 10)); }
        throw new Error('Application did not settle');
    };
    const input = document.querySelector('#files');
    Object.defineProperty(input, 'files', { configurable: true, value: [demo] });
    input.dispatchEvent(new Event('change'));
    await wait(() => document.querySelector('#count').textContent === '1' && document.querySelector('#busy').hidden);
    input.dispatchEvent(new Event('change'));
    await wait(() => document.querySelector('#busy').hidden);
    assert.equal((await storage.listBooks()).length, 1);
    const record = (await storage.listBooks())[0];
    await storage.putProgress({ id: record.id, cfi: 'epubcfi(/6/4)', fraction: .42, updated: 999 });
    document.querySelector('.open-book').click();
    await wait(() => !document.querySelector('#reader').hidden && document.querySelector('#busy').hidden);
    assert.equal(initial, 'epubcfi(/6/4)');
    assert.equal(document.querySelector('#percent').textContent, '42%');
    document.querySelector('#back').click();
    await wait(() => document.querySelector('#reader').hidden);
    assert.equal(document.querySelector('#continue').hidden, false);
    assert.equal((await storage.getProgress(record.id)).cfi, 'epubcfi(/6/4)');
    await clear();
});

test('offline shell caches every shipped app module and referenced dependency', async () => {
    const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
    const assets = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
    for (const path of assets.filter(x => x !== './')) {
        const source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
        if (!path.endsWith('.js')) continue;
        for (const match of source.matchAll(/(?:from\s+|import\()'([^']+)'/g)) {
            if (!match[1].startsWith('.')) continue;
            // Optional MOBI/PDF/comic/TTS features are not exposed by Polka.
            if (/pdf\.js|comic-book\.js|tts\.js/.test(match[1])) continue;
            const target = new URL(match[1], new URL('../' + path, import.meta.url));
            await readFile(target);
        }
    }
});
