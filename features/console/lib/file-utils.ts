/** Reads a File into a lowercase hex string. */
export const fileToHex = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
};
