/**
 * Order ID generation utility for LinkUp Send Orders.
 * Format: LSEND-XXXXXX-XXXX (e.g. LSEND-92A4B8-1934 or LSEND-123456-1234)
 */

export function generateSendOrderId(): string {
  // Uppercase alphanumeric characters excluding ambiguous letters (0, O, 1, I)
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  
  const randomChunk = (length: number): string => {
    let result = '';
    const array = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
      for (let i = 0; i < length; i++) {
        result += alphabet[array[i] % alphabet.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
    return result;
  };

  const mid = randomChunk(6);
  const tail = randomChunk(4);

  return `LSEND-${mid}-${tail}`;
}

export function isValidSendOrderId(id: string): boolean {
  return /^LSEND-[A-Z0-9]{6}-[A-Z0-9]{4}$/i.test(id.trim());
}
