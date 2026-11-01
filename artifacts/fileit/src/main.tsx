import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

// Initialize theme immediately to prevent flash
const savedTheme = localStorage.getItem('theme');
if (
  savedTheme === 'dark' ||
  (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

createRoot(document.getElementById('root')!).render(<App />);
