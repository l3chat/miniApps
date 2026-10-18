import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectTelegram } from '../telegram.js';

function environment() {
    const log = [], events = new Map(), props = new Map();
    const element = { dataset: {}, style: { setProperty: (key, value) => props.set(key, value) } };
    const app = {
        platform: 'android', viewportStableHeight: 720,
        safeAreaInset: { top: 20, bottom: 12 }, contentSafeAreaInset: { top: 30 },
        ready: () => log.push('ready'), expand: () => log.push('expand'),
        setHeaderColor: color => log.push(['header', color]),
        setBackgroundColor: color => log.push(['background', color]),
        setBottomBarColor: color => log.push(['bottom', color]),
        enableVerticalSwipes: () => log.push('swipes-on'),
        disableVerticalSwipes: () => log.push('swipes-off'),
        BackButton: { show: () => log.push('back-show'), hide: () => log.push('back-hide'),
            onClick: fn => events.set('back', fn) },
        SettingsButton: { show() {}, onClick: fn => events.set('settings', fn) },
        onEvent: (name, fn) => events.set(name, fn),
    };
    const host = { Telegram: { WebApp: app }, document: { documentElement: element } };
    return { app, host, element, log, events, props };
}

test('ordinary browser does not activate Telegram hosting', () => {
    const bridge = connectTelegram({ host: {} });
    assert.equal(bridge.enabled, false);
    bridge.ready(); bridge.setReading(true); bridge.setAppearance('#222724');
    assert.equal(connectTelegram({ host: { Telegram: { WebApp: { platform: 'unknown' } } } }).enabled, false);
});
test('Telegram is ready, expanded, respects safe area and routes navigation and lifecycle callbacks', async () => {
    const { app, host, element, log, events, props } = environment();
    let back = 0, deactivated = 0, settings = 0;
    const bridge = connectTelegram({ host, onBack: () => back++, onDeactivate: () => deactivated++, onSettings: () => settings++ });
    bridge.ready();
    assert.equal(element.dataset.telegram, 'true');
    assert.equal(props.get('--host-viewport-height'), '720px');
    assert.equal(props.get('--host-safe-top'), '50px');
    assert.ok(log.includes('ready') && log.includes('expand'));
    bridge.setReading(true);
    assert.ok(log.includes('back-show') && log.includes('swipes-off'));
    await events.get('back')(); events.get('settings')(); events.get('deactivated')();
    assert.deepEqual([back, settings, deactivated], [1, 1, 1]);
    app.viewportStableHeight = 540; events.get('viewportChanged')();
    assert.equal(props.get('--host-viewport-height'), '540px');
    bridge.setReading(false);
    assert.equal(log.at(-1), 'swipes-on');
    bridge.setAppearance('#222724');
    assert.deepEqual(log.at(-1), ['bottom', '#222724']);
    const count = log.length; bridge.setAppearance('javascript:bad');
    assert.equal(log.length, count);
});
test('older Telegram clients without newer APIs remain usable', () => {
    const host = { Telegram: { WebApp: { platform: 'tdesktop', ready() {}, expand() {} } },
        document: { documentElement: { dataset: {}, style: { setProperty() {} } } } };
    const bridge = connectTelegram({ host });
    assert.equal(bridge.enabled, true);
    bridge.ready(); bridge.setReading(true); bridge.setAppearance('#fffcf6');
});
