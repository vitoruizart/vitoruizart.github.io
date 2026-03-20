import { describe, it, expect, vi } from 'vitest';
import * as state from '../js/state.js';

describe('state', () => {
  it('get returns undefined for unset key', () => {
    expect(state.get('nonexistent-key')).toBeUndefined();
  });

  it('set and get roundtrip', () => {
    state.set('test-key', 42);
    expect(state.get('test-key')).toBe(42);
  });

  it('set overwrites previous value', () => {
    state.set('overwrite-key', 'a');
    state.set('overwrite-key', 'b');
    expect(state.get('overwrite-key')).toBe('b');
  });

  it('on fires immediately if key already has a value', () => {
    state.set('existing-key', 'hello');
    const fn = vi.fn();
    state.on('existing-key', fn);
    expect(fn).toHaveBeenCalledWith('hello');
  });

  it('on does NOT fire immediately if key has no value', () => {
    const fn = vi.fn();
    state.on('missing-key-' + Math.random(), fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('on fires when value is set later', () => {
    const fn = vi.fn();
    const key = 'later-key-' + Math.random();
    state.on(key, fn);
    state.set(key, 'deferred');
    expect(fn).toHaveBeenCalledWith('deferred');
  });

  it('unsubscribe stops notifications', () => {
    const fn = vi.fn();
    const key = 'unsub-key-' + Math.random();
    const unsub = state.on(key, fn);
    unsub();
    state.set(key, 'nope');
    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple subscribers all fire', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const key = 'multi-key-' + Math.random();
    state.on(key, fn1);
    state.on(key, fn2);
    state.set(key, 'both');
    expect(fn1).toHaveBeenCalledWith('both');
    expect(fn2).toHaveBeenCalledWith('both');
  });

  it('update transforms existing value', () => {
    const key = 'update-key-' + Math.random();
    state.set(key, 10);
    state.update(key, prev => prev + 5);
    expect(state.get(key)).toBe(15);
  });

  it('update with undefined initial value', () => {
    const key = 'update-undef-' + Math.random();
    state.update(key, prev => (prev ?? 0) + 1);
    expect(state.get(key)).toBe(1);
  });

  it('throwing listener does not prevent other listeners from firing', () => {
    const key = 'throw-key-' + Math.random();
    const fn1 = vi.fn(() => { throw new Error('boom'); });
    const fn2 = vi.fn();
    state.on(key, fn1);
    state.on(key, fn2);
    state.set(key, 'val');
    expect(fn1).toHaveBeenCalledWith('val');
    expect(fn2).toHaveBeenCalledWith('val');
  });
});
