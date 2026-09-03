(() => {
  'use strict';

  const button = document.querySelector('#collaborate-button');
  const status = document.querySelector('#zoom-status');

  function removeOAuthCode() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('code')) return;
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    history.replaceState(null, document.title, url.pathname + url.search + url.hash);
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function onCollaborateChange(event) {
    const active = event?.action === 'start' || event?.status === 'started';
    setStatus(active ? 'Совместный режим запущен' : 'Состояние совместного режима изменилось');
  }

  async function initZoomApp() {
    removeOAuthCode();

    if (!window.zoomSdk) {
      console.info('Zoom Apps SDK is not available; running as a normal web page.');
      return;
    }

    try {
      const config = await window.zoomSdk.config({
        version: '0.16',
        capabilities: [
          'getRunningContext',
          'startCollaborate',
          'onCollaborateChange'
        ]
      });

      console.info('Zoom App initialized:', config);
      document.body.classList.add('zoom-ready');
      button.disabled = false;
      setStatus('Готово к совместному запуску');

      window.zoomSdk.addEventListener('onCollaborateChange', onCollaborateChange);

      if (typeof window.zoomSdk.getRunningContext === 'function') {
        const context = await window.zoomSdk.getRunningContext();
        console.info('Zoom running context:', context);
      }
    } catch (error) {
      console.info('Not running in an initialized Zoom App context.', error);
    }
  }

  button.disabled = true;
  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Запуск совместного режима…');

    try {
      await window.zoomSdk.startCollaborate();
      setStatus('Приглашение отправлено участникам');
    } catch (error) {
      console.error('Unable to start Collaborate Mode.', error);
      setStatus('Не удалось запустить совместный режим');
      button.disabled = false;
    }
  });

  initZoomApp();
})();
