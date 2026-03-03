import { zhCN } from "./zhCN";

type Primitive = string | number | boolean | null | undefined;
type TreeValue = Primitive | TreeValue[] | { [key: string]: TreeValue };
type Params = Record<string, string | number>;

const locale = zhCN as unknown as { [key: string]: TreeValue };

function getByPath(path: string): TreeValue | undefined {
  const parts = path.split(".");
  let current: TreeValue = locale;

  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as { [key: string]: TreeValue })[part];
  }

  return current;
}

function interpolate(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function t(key: string, params?: Params): string {
  const value = getByPath(key);
  if (typeof value !== "string") {
    return key;
  }
  return interpolate(value, params);
}

export function getLocaleValue<T>(key: string): T {
  return getByPath(key) as T;
}

