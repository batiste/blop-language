/**
 * Runtime State Management Tests
 * 
 * Tests for state, context, and component lifecycle
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { Component } from '../../runtime.js';

describe('Component.state', () => {
  let component;

  beforeEach(() => {
    component = new Component(() => {}, {}, [], 'test-component');
  });

  test('initializes state with initial value', () => {
    const { value, setState, getState } = component.state('count', 0);
    
    expect(value).toBe(0);
    expect(getState()).toBe(0);
  });

  test('returns same value on subsequent calls with same name', () => {
    const first = component.state('count', 0);
    const second = component.state('count', 99);
    
    expect(first.value).toBe(0);
    expect(second.value).toBe(0); // Should not reinitialize
  });

  test('setState updates state value', () => {
    const { setState, getState } = component.state('count', 0);
    
    setState(5);
    expect(getState()).toBe(5);
    
    setState(10);
    expect(getState()).toBe(10);
  });

  test('handles falsy values correctly (bug fix test)', () => {
    // This test verifies the fix from || to ??
    const { setState, getState } = component.state('visible', true);
    
    setState(false);
    expect(getState()).toBe(false);
    
    // Re-call state - should maintain false, not reset to true
    const { value } = component.state('visible', true);
    expect(value).toBe(false);
    expect(getState()).toBe(false);
  });

  test('handles zero value correctly', () => {
    const { setState, getState } = component.state('count', 10);
    
    setState(0);
    expect(getState()).toBe(0);
    
    // Re-call state - should maintain 0
    const { value } = component.state('count', 10);
    expect(value).toBe(0);
  });

  test('handles empty string correctly', () => {
    const { setState, getState } = component.state('text', 'initial');
    
    setState('');
    expect(getState()).toBe('');
    
    // Re-call state - should maintain empty string
    const { value } = component.state('text', 'initial');
    expect(value).toBe('');
  });

  test('handles null value correctly', () => {
    const { setState, getState } = component.state('data', { test: true });
    
    setState(null);
    expect(getState()).toBe(null);
    
    // Re-call state - should reinitialize with null to initial value
    const { value } = component.state('data', { test: true });
    expect(value).toEqual({ test: true });
  });

  test('handles undefined value correctly', () => {
    const { setState, getState } = component.state('data', 'initial');
    
    setState(undefined);
    expect(getState()).toBe(undefined);
    
    // Re-call state - should reinitialize with undefined to initial value
    const { value } = component.state('data', 'initial');
    expect(value).toBe('initial');
  });

  test('supports multiple independent states', () => {
    const count = component.state('count', 0);
    const text = component.state('text', 'hello');
    const visible = component.state('visible', true);
    
    expect(count.value).toBe(0);
    expect(text.value).toBe('hello');
    expect(visible.value).toBe(true);
    
    count.setState(5);
    text.setState('world');
    visible.setState(false);
    
    expect(count.getState()).toBe(5);
    expect(text.getState()).toBe('world');
    expect(visible.getState()).toBe(false);
  });

  test('setState updates internal state immediately', () => {
    const { setState, getState } = component.state('count', 0);
    
    setState(5);
    // State should be updated immediately (scheduleRender happens async for DOM)
    expect(getState()).toBe(5);
    
    setState(10);
    expect(getState()).toBe(10);
  });

  test('getState returns current value even after closure capture', () => {
    const { value, setState, getState } = component.state('count', 0);
    
    // Simulate closure capture (this is what happens in event handlers)
    const capturedValue = value;
    const increment = () => setState(getState() + 1);
    
    expect(capturedValue).toBe(0);
    
    setState(5);
    expect(capturedValue).toBe(0); // Still captured value
    expect(getState()).toBe(5); // But getState returns current
    
    increment();
    expect(getState()).toBe(6);
  });

  test('handles object state updates', () => {
    const initialState = { count: 0, name: 'test' };
    const { setState, getState } = component.state('obj', initialState);
    
    setState({ count: 5, name: 'updated' });
    expect(getState()).toEqual({ count: 5, name: 'updated' });
  });

  test('handles array state updates', () => {
    const { setState, getState } = component.state('items', [1, 2, 3]);
    
    setState([4, 5, 6]);
    expect(getState()).toEqual([4, 5, 6]);
    
    // Test spread operator pattern
    const current = getState();
    setState([...current, 7]);
    expect(getState()).toEqual([4, 5, 6, 7]);
  });
});

describe('Component.context', () => {
  let parent;
  let child;

  beforeEach(() => {
    parent = new Component(() => {}, {}, [], 'parent');
    child = new Component(() => {}, {}, [], 'child');
    child.parent = parent;
  });

  test('initializes context with initial value', () => {
    const { value } = parent.context('theme', 'dark');
    expect(value).toBe('dark');
  });

  test('setContext updates context value', () => {
    const { setContext, getContext } = parent.context('theme', 'dark');
    
    setContext('light');
    expect(getContext()).toBe('light');
  });

  test('child can access parent context', () => {
    // Set up parent context
    const parentCtx = parent.context('theme', 'dark');
    parentCtx.setContext('light');
    
    // Child should be able to read it
    const childCtx = child.context('theme');
    expect(childCtx.value).toBe('light');
  });

  test('handles undefined context gracefully', () => {
    const { value, getContext } = child.context('nonexistent');
    
    expect(value).toBeUndefined();
    expect(getContext()).toBeUndefined();
  });
});

describe('Component lifecycle', () => {
  let component;

  beforeEach(() => {
    component = new Component(() => {}, {}, [], 'test');
  });

  test('mount callbacks are called on _mount', () => {
    const callback = vi.fn();
    component.mount(callback);
    
    component._mount();
    
    expect(callback).toHaveBeenCalled();
    expect(component.mounted).toBe(true);
  });

  test('unmount callbacks are called on _unmount', () => {
    const callback = vi.fn();
    
    // Must register callback before mounting (as done during render)
    component.unmount(callback);
    component._mount();
    component._unmount();
    
    expect(callback).toHaveBeenCalled();
    expect(component.mounted).toBe(false);
  });

  test('mount callbacks are cleared after mounting', () => {
    const callback = vi.fn();
    component.mount(callback);
    
    component._mount();
    expect(component.life.mount).toEqual([]);
  });

  test('unmount callbacks are cleared after unmounting', () => {
    const callback = vi.fn();
    component._mount();
    
    component.unmount(callback);
    component._unmount();
    
    expect(component.life.unmount).toEqual([]);
  });

  test('multiple mount callbacks are all called', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const callback3 = vi.fn();
    
    component.mount(callback1);
    component.mount(callback2);
    component.mount(callback3);
    
    component._mount();
    
    expect(callback1).toHaveBeenCalled();
    expect(callback2).toHaveBeenCalled();
    expect(callback3).toHaveBeenCalled();
  });

  test('_destroy cleans up component state', () => {
    component.stateMap = { test: 'data' };
    component.contextMap = { theme: 'dark' };
    component.children = ['child1'];
    
    component._destroy();
    
    expect(component.destroyed).toBe(true);
    expect(component.stateMap).toEqual({});
    expect(component.contextMap).toEqual({});
    expect(component.children).toEqual([]);
    expect(component.parent).toBeNull();
  });
});

describe('Component.onChange', () => {
  let component;

  beforeEach(() => {
    component = new Component(() => {}, { prop: 'initial' }, [], 'test');
  });

  test('registers onChange callback', () => {
    const callback = vi.fn();
    component.onChange('prop', callback);
    
    expect(component.onChangeRegistry['prop']).toBeDefined();
    expect(component.onChangeRegistry['prop'].callback).toBe(callback);
  });

  test('callback is called when attribute changes', () => {
    const callback = vi.fn();
    component.onChange('prop', callback);
    
    component.attributes.prop = 'changed';
    component._checkOnChange();
    
    expect(callback).toHaveBeenCalled();
  });

  test('callback is not called when attribute stays same', () => {
    const callback = vi.fn();
    component.onChange('prop', callback);
    
    component._checkOnChange();
    
    expect(callback).not.toHaveBeenCalled();
  });
});

describe('Component mount cleanup', () => {
  let component;

  beforeEach(() => {
    component = new Component(() => {}, {}, [], 'test');
  });

  test('cleanup functions returned from mount are called on unmount', () => {
    const cleanup = vi.fn();
    
    component.mount(() => {
      return cleanup;
    });
    
    component._mount();
    expect(cleanup).not.toHaveBeenCalled();
    
    component._unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  test('multiple cleanup functions are called in reverse order', () => {
    const order = [];
    
    component.mount(() => {
      return () => order.push('cleanup1');
    });
    component.mount(() => {
      return () => order.push('cleanup2');
    });
    component.mount(() => {
      return () => order.push('cleanup3');
    });
    
    component._mount();
    component._unmount();
    
    // Should be called in LIFO order
    expect(order).toEqual(['cleanup3', 'cleanup2', 'cleanup1']);
  });

  test('non-function return values are ignored', () => {
    const cleanup = vi.fn();
    
    component.mount(() => {
      return 'not a function'; // Should be ignored
    });
    component.mount(() => {
      return cleanup;
    });
    
    component._mount();
    component._unmount();
    
    expect(cleanup).toHaveBeenCalled();
  });

  test('cleanup functions are cleared after unmounting', () => {
    component.mount(() => {
      return () => {};
    });
    
    component._mount();
    component._unmount();
    
    expect(component.life.mountCleanup).toEqual([]);
  });
});
