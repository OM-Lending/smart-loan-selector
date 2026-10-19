import 'server-only';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchCDR(url: string, headers: Record<string, string> = {}, retries = 3) {
  let lastError = 'Unknown CDR request error';
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
        const responseText = await res.text().catch(() => '');
        const responseDetails = responseText ? `: ${responseText.slice(0, 500)}` : '';
        if (res.status === 429) {
          console.warn(`[CDR Rate Limited] 429 on ${url}. Retrying...`);
          throw new Error(`HTTP 429 Rate Limited${responseDetails}`);
        }
        throw new Error(`HTTP ${res.status}${responseDetails}`);
      }

      return await res.json();

    } catch (error: unknown) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error.message : String(error);
      
      const isLastAttempt = i === retries - 1;
      if (isLastAttempt) {
        console.error(`[CDR Fetch Error] Final failure on ${url} after ${retries} attempts:`, lastError);
        throw new Error(`CDR request failed after ${retries} attempts: ${lastError}`);
      }
      await delay(1000 * (i + 1)); 
    }
  }
  throw new Error(`CDR request failed: ${lastError}`);
}
