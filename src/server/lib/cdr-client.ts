import 'server-only';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchCDR(url: string, headers: Record<string, string> = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
      const res = await fetch(url, { 
        headers, 
        next: { revalidate: 0 },
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 429) {
          console.warn(`[CDR Rate Limited] 429 on ${url}. Retrying...`);
          throw new Error('Rate Limited');
        }
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.json();

    } catch (error: any) {
      clearTimeout(timeoutId);
      
      const isLastAttempt = i === retries - 1;
      if (isLastAttempt) {
        console.warn(`[CDR Fetch Error] Final failure on ${url} after ${retries} attempts:`, error.message);
        return null; 
      }
      await delay(1000 * (i + 1)); 
    }
  }
}