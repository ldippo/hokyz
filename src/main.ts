import './ui/styles.css';
import { App } from './app';
import { titleScreen } from './ui/screens/title';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLElement;
const app = new App(canvas, ui);
app.start();
titleScreen(app);
(window as any).__hokyz = app;
