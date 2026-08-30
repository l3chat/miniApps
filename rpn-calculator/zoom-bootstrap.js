(() => {
  'use strict';

  async function initZoomApp() {
    if (!window.zoomSdk) {
      console.info('Zoom Apps SDK is not available; running as a normal web page.');
      return;
    }

    try {
      const config = await window.zoomSdk.config({
        version: '0.16',
        capabilities: ['getRunningContext']
      });

      console.info('Zoom App initialized:', config);

      if (typeof window.zoomSdk.getRunningContext === 'function') {
        const context = await window.zoomSdk.getRunningContext();
        console.info('Zoom running context:', context);
      }
    } catch (error) {
      console.info('Not running in an initialized Zoom App context.', error);
    }
  }

  initZoomApp();
})();
