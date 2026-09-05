import './ui/styles.css';
import { App } from './app';
import { titleScreen } from './ui/screens/title';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const app = new App(canvas, ui);
void app.init().then(() => {
  if (new URLSearchParams(location.search).has('rigview')) {
    void import('./render/rigViewer').then((m) => m.startRigViewer(app));
    return;
  }
  app.start();
  titleScreen(app);
  const seed = new URLSearchParams(location.search).get('seed');
  if (seed) void import('./ui/screens/captain').then((m) => m.captainScreen(app, null, seed));
});
(window as any).__hokyz = app;
