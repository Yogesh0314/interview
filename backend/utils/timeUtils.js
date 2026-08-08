/**
 * Computes the time state for an ongoing interview.
 * 
 * Time States:
 * - EXPIRED: remainingSeconds <= 0
 * - CLOSING: 0 < remainingSeconds <= 45 (Not enough time for a new question)
 * - TIME_LIMITED: 45 < remainingSeconds <= 120 (2 mins or less left; ask concise questions)
 * - NORMAL: remainingSeconds > 120 (Plenty of time; normal probing)
 */
export function getInterviewTimeState(interview) {
  const startTimeMs = new Date(interview.startTime || interview.createdAt || Date.now()).getTime();
  const durationMinutes = Number(interview.length || '15');
  const durationMs = durationMinutes * 60 * 1000;

  // Use explicit endTime if set, otherwise calculate from startTime + duration
  const endTimeMs = interview.endTime
    ? new Date(interview.endTime).getTime()
    : startTimeMs + durationMs;

  const elapsedMs = Date.now() - startTimeMs;
  const remainingMs = endTimeMs - Date.now();
  const remainingSeconds = Math.floor(remainingMs / 1000);

  let state = 'NORMAL';
  if (remainingSeconds <= 0) {
    state = 'EXPIRED';
  } else if (remainingSeconds <= 45) {
    state = 'CLOSING';
  } else if (remainingSeconds <= 120) {
    state = 'TIME_LIMITED';
  }

  return {
    state,
    remainingSeconds,
    elapsedMs,
    durationMs,
    endTimeMs,
  };
}
