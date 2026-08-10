function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')                   // Separate accents from base characters
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 -]/g, '')        // Remove non-alphanumeric characters (except space & hyphen)
    .replace(/\s+/g, '-')               // Replace spaces with hyphens
    .replace(/-+/g, '-');              // Collapse consecutive hyphens
}


export {slugify};