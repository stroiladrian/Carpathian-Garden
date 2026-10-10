import './style.css';
import { App } from './app';

// Touch devices get the thumb-friendly layout and controls.
if (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !window.matchMedia('(pointer: fine)').matches) {
  document.documentElement.classList.add('touch');
}

function boot(): void {
  const app = new App();
  (window as unknown as { __cg: App }).__cg = app;
}

// Wait (briefly) for the display font so canvas labels render with it.
const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
if (fonts && fonts.load) {
  Promise.race([
    Promise.all([fonts.load('20px "Lilita One"'), fonts.load('800 16px "Nunito"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).finally(boot);
} else {
  boot();
}
