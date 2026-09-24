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

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    return [...bytes].map((byte, index) => {
      const value = byte.toString(16).padStart(2, "0");
      return [4, 6, 8, 10].includes(index) ? `-${value}` : value;
    }).join("");
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export { generateId, slugify };