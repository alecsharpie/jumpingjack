import { KungFoo } from './kungfoo.js';
import { WishiWashi } from './wishiwashi.js';
import { Bubbles } from './bubbles.js';
import { KeepUps } from './keepups.js';
import { JumpingJacks } from './jumpingjacks.js';
import { RockPaperScissors } from './rps.js';
import { HandSigns } from './handsigns.js';

export const GAMES = [
  { id: 'kungfoo', title: 'KUNG FOO', icon: '🥋', color: '#e63946', desc: 'Punch and kick the flying ninjas!', make: (G) => new KungFoo(G) },
  { id: 'wishiwashi', title: 'WISHI WASHI', icon: '🧽', color: '#00a8e8', desc: 'Wipe the grimy windows clean, fast! (co-op)', make: (G) => new WishiWashi(G) },
  { id: 'rps', title: 'ROCK PAPER SCISSORS', icon: '✊', color: '#f15bb5', desc: 'Hand-sign showdown vs the CPU, or a friend!', make: (G) => new RockPaperScissors(G) },
  { id: 'jumpingjacks', title: 'JUMPING JACKS', icon: '🤸', color: '#ff8a00', desc: 'How many jumping jacks can you do in 30 seconds?', make: (G) => new JumpingJacks(G) },
  { id: 'handsigns', title: 'HAND SIGNS', icon: '🤟', color: '#00bbf9', desc: 'Copy the hand sign as fast as you can!', make: (G) => new HandSigns(G) },
  { id: 'bubbles', title: 'BUBBLE POP', icon: '🫧', color: '#9b5de5', desc: 'Pop bubbles with your whole body, and dodge the bombs!', make: (G) => new Bubbles(G) },
  { id: 'keepups', title: 'KEEPY UPPY', icon: '⚽', color: '#2ec4b6', desc: 'Keep the football up with headers, knees and kicks!', make: (G) => new KeepUps(G) },
];
