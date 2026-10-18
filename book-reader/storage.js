// Book files stay in IndexedDB. Progress is separate, so turning a page never
// rewrites a multi-megabyte book. localStorage is a synchronous lifecycle journal.
export const DB_NAME = 'polka-library-v1';
const JOURNAL = 'polka-position:';
let connection;

function database() {
    connection ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            for (const name of ['books', 'progress'])
                request.result.createObjectStore(name, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Закройте другие вкладки библиотеки и обновите страницу.'));
    });
    return connection;
}

async function transaction(stores, mode, work) {
    const db = await database();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        let result;
        tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Не удалось сохранить данные.'));
        try { result = work(tx); } catch (error) { tx.abort(); reject(error); }
    });
}

export const listBooks = () => transaction(['books'], 'readonly', tx => tx.objectStore('books').getAll());
export const getBook = id => transaction(['books'], 'readonly', tx => tx.objectStore('books').get(id));
export const putBook = book => transaction(['books'], 'readwrite', tx => tx.objectStore('books').put(book));
export const getProgress = async id => {
    const saved = await transaction(['progress'], 'readonly', tx => tx.objectStore('progress').get(id));
    let journal;
    try { journal = JSON.parse(localStorage.getItem(JOURNAL + id)); } catch { /* IDB remains authoritative. */ }
    return journal?.updated > (saved?.updated ?? 0) ? journal : saved;
};
export const putProgress = progress => transaction(['progress'], 'readwrite', tx => tx.objectStore('progress').put(progress));
export function journalProgress(progress) {
    try { localStorage.setItem(JOURNAL + progress.id, JSON.stringify(progress)); return true; }
    catch { return false; }
}
export async function deleteBook(id) {
    await transaction(['books', 'progress'], 'readwrite', tx => {
        tx.objectStore('books').delete(id);
        tx.objectStore('progress').delete(id);
    });
    try { localStorage.removeItem(JOURNAL + id); } catch { /* Already deleted from IDB. */ }
}

export function readSettings() {
    try { return JSON.parse(localStorage.getItem('polka-settings')) ?? {}; }
    catch { return {}; }
}
export function writeSettings(settings) {
    try { localStorage.setItem('polka-settings', JSON.stringify(settings)); } catch { /* Optional preference. */ }
}
