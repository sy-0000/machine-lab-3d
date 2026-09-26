// Standalone page: the workshop on its own, with console helpers on window.workshop.
import { createWorkshop } from './workshop.js';

createWorkshop(document.getElementById('app'), { debug: true }).catch((err) => {
  console.error('[workshop] failed to start', err);
});
