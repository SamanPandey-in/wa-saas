/**
 * Simple async rate-limited queue
 * @param {Array} items - items to process
 * @param {Function} handler - async function(item) => result
 * @param {number} delayMs - delay between each call (default 200ms = ~5 msgs/sec, safe)
 */
async function processQueue(items, handler, delayMs = 200) {
  const results = [];
  for (const item of items) {
    try {
      const result = await handler(item);
      results.push({ item, result, success: true });
    } catch (err) {
      results.push({ item, error: err.message, success: false });
    }
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

export default processQueue;
