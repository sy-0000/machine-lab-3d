// 互動狀態機：BROWSE → LIFTING → SHOWCASE ⇄ SWITCHING，SHOWCASE → RETURNING → BROWSE
export const STATES = Object.freeze({
  BROWSE: 'BROWSE', LIFTING: 'LIFTING', SHOWCASE: 'SHOWCASE', SWITCHING: 'SWITCHING', RETURNING: 'RETURNING',
});

const TRANSITIONS = {
  BROWSE: ['LIFTING'],
  LIFTING: ['SHOWCASE'],
  SHOWCASE: ['SWITCHING', 'RETURNING'],
  SWITCHING: ['SHOWCASE'],
  RETURNING: ['BROWSE'],
};

export class StateMachine {
  constructor(initial = STATES.BROWSE) {
    this.state = initial;
    this.listeners = new Set();
  }
  is(s) { return this.state === s; }
  can(next) { return TRANSITIONS[this.state].includes(next); }
  go(next) {
    if (!this.can(next)) return false;
    const prev = this.state;
    this.state = next;
    this.listeners.forEach((fn) => fn(next, prev));
    return true;
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}
