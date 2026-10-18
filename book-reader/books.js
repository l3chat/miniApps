import { makeBook } from './vendor/foliate/view.js';
import { configure, ZipReader, BlobReader, BlobWriter } from './vendor/foliate/vendor/zip.js';

configure({ useWebWorkers: false });
export const MAX_BOOK_BYTES = 64 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024;
export const isBookFile = name => /\.(epub|fb2|fb2\.zip|fbz)$/i.test(name);
export const formatSize = n => n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} КБ` : `${(n / 1024 / 1024).toFixed(1)} МБ`;
export const percent = value => Math.round(Math.min(1, Math.max(0, value || 0)) * 100) + '%';
export function languageText(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') return languageText(Object.values(value)[0]);
    return '';
}
export function authorText(value) {
    return (Array.isArray(value) ? value : [value]).filter(Boolean)
        .map(x => typeof x === 'string' ? x : languageText(x.name)).filter(Boolean).join(', ');
}
export async function fileID(blob) {
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
        n => n.toString(16).padStart(2, '0')).join('');
}

// Remove active content before EPUB sections become same-origin blob documents.
// The page's restrictive CSP also applies to all the book's child frames.
export function sanitizeDocument(data, type) {
    if (!/html|svg\+xml/.test(type)) return data;
    const mime = type === 'text/html' ? type : type === 'image/svg+xml' ? type : 'application/xhtml+xml';
    const doc = new DOMParser().parseFromString(data, mime);
    if (doc.querySelector('parsererror')) throw new Error('Повреждённый раздел EPUB.');
    for (const el of [...doc.getElementsByTagName('*')]) {
        if (['script', 'iframe', 'frame', 'object', 'embed', 'base', 'form', 'input', 'button', 'textarea', 'select'].includes(el.localName.toLowerCase()) ||
            (el.localName.toLowerCase() === 'meta' && el.hasAttribute('http-equiv'))) {
            el.remove(); continue;
        }
        for (const attribute of [...el.attributes]) {
            const name = attribute.localName.toLowerCase();
            const value = attribute.value.replace(/[\u0000-\u0020]/g, '');
            if (name.startsWith('on') || name === 'srcdoc' ||
                (['href', 'src', 'action'].includes(name) && /^(javascript|vbscript):/i.test(value)))
                el.removeAttributeNode(attribute);
        }
    }
    return new XMLSerializer().serializeToString(doc);
}

export async function openBookFile(file) {
    if (!isBookFile(file.name)) throw new Error('Поддерживаются EPUB, FB2 и FB2.ZIP.');
    if (!file.size || file.size > MAX_BOOK_BYTES) throw new Error('Размер книги должен быть от 1 байта до 64 МБ.');
    const normalized = new File([file], file.name.toLowerCase(), { type: file.type });
    let source = normalized;
    if (/\.(epub|zip|fbz)$/i.test(file.name)) {
        const zip = new ZipReader(new BlobReader(normalized));
        try {
            const entries = await zip.getEntries();
            if (entries.length > 10000 || entries.reduce((n, e) => n + e.uncompressedSize, 0) > MAX_EXPANDED_BYTES)
                throw new Error('Слишком большой распакованный архив книги.');
            if (!/\.epub$/i.test(file.name)) {
                const entry = entries.find(e => !e.directory && /\.fb2$/i.test(e.filename));
                if (!entry) throw new Error('В архиве не найден файл FB2.');
                source = new File([await entry.getData(new BlobWriter())], 'book.fb2');
            }
        } finally { await zip.close(); }
    }
    const book = await makeBook(source);
    if (!book.sections?.length) { book.destroy?.(); throw new Error('В книге не найден текст.'); }
    book.transformTarget?.addEventListener('data', ({ detail }) => {
        if (/html|svg\+xml/.test(detail.type))
            detail.data = Promise.resolve(detail.data).then(data => sanitizeDocument(data, detail.type));
    });
    return book;
}

export async function describeBook(file) {
    const book = await openBookFile(file);
    try {
        // Keep cover SVG out of the UI's image path; images inside the reader
        // remain available, including SVG and native MathML.
        let cover;
        try { cover = await book.getCover?.(); } catch { /* A missing cover must not prevent reading. */ }
        if (!cover?.type?.match(/^image\/(jpeg|png|webp|gif|avif)$/i) || cover.size > 4 * 1024 * 1024) cover = null;
        return {
            id: await fileID(file), name: file.name, data: file, size: file.size,
            title: languageText(book.metadata?.title) || file.name.replace(/\.(epub|fb2(?:\.zip)?|fbz)$/i, ''),
            author: authorText(book.metadata?.author), cover,
            format: /\.epub$/i.test(file.name) ? 'EPUB' : 'FB2', added: Date.now(),
        };
    } finally { book.destroy?.(); }
}
