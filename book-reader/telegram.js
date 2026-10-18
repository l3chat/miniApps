// Telegram is an optional presentation host, not an authentication provider here.
// No initData/user details are stored, trusted, logged or sent to a server.
export function connectTelegram({ onBack, onDeactivate, onSettings, host = window }) {
    const app = host.Telegram?.WebApp;
    const enabled = Boolean(app && app.platform && app.platform !== 'unknown');
    if (!enabled) return { enabled: false, ready() {}, setReading() {}, setAppearance() {} };
    const root = host.document.documentElement;
    root.dataset.telegram = 'true';
    const call = fn => { try { fn(); } catch { /* Older Telegram clients remain usable. */ } };
    let reading = false, color = '#f5f1e8';
    const updateViewport = () => {
        const height = Number(app.viewportStableHeight);
        if (height > 0 && height < 10000) root.style.setProperty('--host-viewport-height', `${height}px`);
        for (const edge of ['top', 'right', 'bottom', 'left']) {
            const safe = Number(app.safeAreaInset?.[edge]) || 0;
            const content = Number(app.contentSafeAreaInset?.[edge]) || 0;
            root.style.setProperty(`--host-safe-${edge}`, `${Math.min(200, Math.max(0, safe + content))}px`);
        }
    };
    const setAppearance = nextColor => {
        if (!/^#[0-9a-f]{6}$/i.test(nextColor)) return;
        color = nextColor;
        call(() => app.setHeaderColor(color));
        call(() => app.setBackgroundColor(color));
        call(() => app.setBottomBarColor(color));
    };
    const setReading = next => {
        reading = Boolean(next);
        call(() => reading ? app.BackButton.show() : app.BackButton.hide());
        // The reader's scrolling must not drag the Mini App closed.
        call(() => reading ? app.disableVerticalSwipes() : app.enableVerticalSwipes());
    };
    const back = () => Promise.resolve(onBack?.()).catch(() => {});
    const deactivate = () => onDeactivate?.();
    call(() => app.BackButton.onClick(back));
    call(() => app.SettingsButton.onClick(onSettings));
    call(() => app.SettingsButton.show());
    for (const event of ['viewportChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'activated'])
        call(() => app.onEvent(event, updateViewport));
    call(() => app.onEvent('deactivated', deactivate));
    call(() => app.onEvent('themeChanged', () => setAppearance(color)));
    updateViewport(); setReading(false); setAppearance(color);
    return {
        enabled: true, setReading, setAppearance,
        ready() { call(() => app.ready()); call(() => app.expand()); updateViewport(); },
    };
}
