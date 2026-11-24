// ============================================================================
// VANGUARD 2089 — Entry Point Bootstrap
// ============================================================================
import { UIController } from './ui.js';
import { VanguardGame } from './game.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  const ui = new UIController();
  const game = new VanguardGame(canvas, ui);
  ui.attach(game);
  window.__VANGUARD__ = game;
});
