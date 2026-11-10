import React from 'react';
import { renderToString } from 'react-dom/server';

// Set up mock window, document, and localStorage
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

(global as any).window = {
  location: {
    hash: '',
    pathname: '/',
    reload: () => {}
  },
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })
};
(global as any).localStorage = mockLocalStorage;
(global as any).document = {
  documentElement: {
    requestFullscreen: async () => {}
  },
  fullscreenElement: null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function testRender() {
  try {
    const { App } = await import('../App');
    console.log('Rendering App with empty storage (Fresh session)...');
    const html = renderToString(React.createElement(App));
    console.log('Rendered successfully! Length:', html.length);
    if (html.includes('Application Runtime Anomaly')) {
      console.error('CRASH DETECTED: HTML contains "Application Runtime Anomaly"!');
    } else {
      console.log('No Application Runtime Anomaly in HTML.');
    }
  } catch (err) {
    console.error('EXCEPTION CAUGHT DURING RENDER:', err);
  }
}

testRender();
