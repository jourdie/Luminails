export function normalizeCatalogBrand(value: string | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

export function catalogBrandsMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeCatalogBrand(left);
  const normalizedRight = normalizeCatalogBrand(right);
  return normalizedLeft.length > 0 && normalizedLeft === normalizedRight;
}
