export function formatRyp(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatLabel(value: string) {
  return value.replace(/_/g, " ");
}

