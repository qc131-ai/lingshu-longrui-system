export function toPrismaEnum(value: string | undefined): string | undefined {
  return value?.replaceAll("-", "_").toUpperCase();
}

export function optionalEnum(value: string | undefined, fallback: string) {
  return toPrismaEnum(value) ?? fallback;
}
