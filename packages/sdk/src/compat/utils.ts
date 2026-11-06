type Fields = Record<string, unknown>;
export function isPlainObject(value: unknown): boolean { return value !== null && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value)); }
export function isString(value: unknown): boolean { return typeof value === 'string'; }
export function isFunction(value: unknown): boolean { return typeof value === 'function'; }
export function capitalize(value: string): string { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value; }
export function last<T>(values: T[]): T | undefined { return values[values.length - 1]; }
export function pick(value: object, keys: string[]): Fields { return Object.fromEntries(keys.filter((key: string): boolean => Object.prototype.hasOwnProperty.call(value, key)).map((key: string): [string, unknown] => [key, (value as Fields)[key]])); }
export function omit(value: Fields, keys: string[]): Fields { return Object.fromEntries(Object.entries(value).filter(([key]): boolean => !keys.includes(key))); }
function safeKey(key: string): boolean { return !['__proto__', 'constructor', 'prototype'].includes(key); }
export function mixin(deep: boolean, target: Fields, ...sources: unknown[]): Fields {
  return sources.reduce<Fields>((current: Fields, source: unknown): Fields => {
    if (!isPlainObject(source)) return current;
    return Object.fromEntries([...new Set([...Object.keys(current), ...Object.keys(source as Fields)])].filter(safeKey).map((key: string): [string, unknown] => {
      if (!Object.prototype.hasOwnProperty.call(source, key)) return [key, current[key]];
      const next: unknown = (source as Fields)[key];
      return [key, deep && isPlainObject(next) ? mixin(true, isPlainObject(current[key]) ? current[key] as Fields : {}, next) : next];
    }));
  }, { ...target });
}
export function retrieveData(source: unknown, reference: string): unknown {
  return reference.split('.').reduce<unknown>((current: unknown, key: string): unknown => safeKey(key) && current !== null && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, key) ? (current as Fields)[key] : undefined, source);
}
export function saveData(source: Fields, reference: string, value: unknown, merge: boolean = false): Fields {
  const keys: string[] = reference.split('.');
  if (!keys.length || keys.some((key: string): boolean => !key || !safeKey(key))) throw new Error('Invalid object reference');
  const write = (current: Fields, index: number): Fields => {
    const key: string = keys[index];
    if (index === keys.length - 1) return { ...current, [key]: merge && isPlainObject(value) ? mixin(true, isPlainObject(current[key]) ? current[key] as Fields : {}, value) : value };
    return { ...current, [key]: write(isPlainObject(current[key]) ? current[key] as Fields : {}, index + 1) };
  };
  return write(source, 0);
}
