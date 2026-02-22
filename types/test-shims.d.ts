interface ImportMeta {
  readonly main?: boolean;
}

type TestCallback = () => void | Promise<void>;

interface ExpectMatchers {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
}

declare module "vitest" {
  export function describe(name: string, fn: TestCallback): void;
  export interface ItFn {
    (name: string, fn: TestCallback): void;
    each<T>(cases: readonly T[]): (name: string, fn: (arg: T) => void | Promise<void>) => void;
  }
  export const it: ItFn;
  export function expect(actual: unknown): ExpectMatchers;
}

declare module "vitest/config" {
  export function defineConfig(config: Record<string, unknown>): Record<string, unknown>;
}
