import { Share, Platform } from 'react-native';

const BOM = '\uFEFF';

function escapeCsvCell(value: string): string {
  const s = String(value ?? '').replace(/"/g, '""');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
}

export function toCsvRow(values: (string | number)[]): string {
  return values.map((v) => escapeCsvCell(String(v))).join(',');
}

export async function shareCsv(content: string, filename: string): Promise<void> {
  const withBom = Platform.OS === 'android' ? BOM + content : content;
  await Share.share({
    message: withBom,
    title: filename,
  });
}
