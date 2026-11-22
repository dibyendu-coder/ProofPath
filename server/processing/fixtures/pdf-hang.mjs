import process from 'node:process';

process.on('message', () => {
  /* Intentionally never sends a result. */
});
