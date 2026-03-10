export const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1-3u_uuEcPW98KvqKQ_ivdW0qG9FA3YMoF-Cl2zfuZI0/export?format=csv&gid=221567762';

export async function fetchSheetData(): Promise<string> {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    const csvText = await response.text();
    return csvText;
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    throw error;
  }
}
