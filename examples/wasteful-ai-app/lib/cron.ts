// WASTEFUL: runs every single minute regardless of whether there is work to do,
// and also polls on a 5-second setInterval.

// Vercel / node-cron style schedule string.
export const schedule = "* * * * *"; // every minute

export function startPolling(check: () => void) {
  // Fires every 5 seconds, all day, even when idle.
  setInterval(() => {
    check();
  }, 5000);
}
