import './styles.css';
import { bootstrapApp } from './app/app.js';

function start() {
  bootstrapApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
