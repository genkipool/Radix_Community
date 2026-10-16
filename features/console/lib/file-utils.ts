/** Reads a File into a lowercase hex string. */
export const fileToHex = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** Saves text as a file through a temporary download link. */
export const downloadTextFile = (name: string, text: string, type = 'text/csv') => {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
