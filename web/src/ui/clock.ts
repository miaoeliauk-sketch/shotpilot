import { useSyncExternalStore } from 'react';

/**
 * 一个很小的可订阅的值。播放时间每秒变 60 次，
 * 只让需要它的地方（播放头、时间码）跟着重画，整个工作台不用跟着刷新。
 */
export type Clock = { get: () => number; set: (v: number) => void; subscribe: (fn: () => void) => () => void };

export function createClock(initial = 0): Clock {
  let value = initial;
  const fns = new Set<() => void>();
  return {
    get: () => value,
    set: (v) => {
      if (v === value) return;
      value = v;
      fns.forEach((f) => f());
    },
    subscribe: (fn) => {
      fns.add(fn);
      return () => fns.delete(fn);
    },
  };
}

export function useClock(clock: Clock): number {
  return useSyncExternalStore(clock.subscribe, clock.get);
}
