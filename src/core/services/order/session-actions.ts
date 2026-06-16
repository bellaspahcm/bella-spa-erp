'use server';

import { completeSession as completeSessionAction } from './complete-session-action';
import { updateSessionLog as updateSessionLogAction } from './update-session-log-action';
import {
  getCalendarSessions as getCalendarSessionsAction,
  getSessionLogs as getSessionLogsAction,
  getSessionsWithDetails as getSessionsWithDetailsAction,
} from './session-query-actions';
import {
  addExtraSession as addExtraSessionAction,
  saveSessionNote as saveSessionNoteAction,
} from './session-mutation-actions';
import { createSessionLog as createSessionLogAction } from './create-session-log-action';
import { rescheduleSession as rescheduleSessionAction } from './reschedule-session-action';

export async function updateSessionLog(id: string, payload: Parameters<typeof updateSessionLogAction>[1]) {
  return updateSessionLogAction(id, payload);
}

export async function completeSession(sessionId: string, bookingId: string, customNote?: string) {
  return completeSessionAction(sessionId, bookingId, customNote);
}

export async function saveSessionNote(sessionId: string, note: string) {
  return saveSessionNoteAction(sessionId, note);
}

export async function addExtraSession(bookingId: string) {
  return addExtraSessionAction(bookingId);
}

export async function createSessionLog(data: Parameters<typeof createSessionLogAction>[0]) {
  return createSessionLogAction(data);
}

export async function rescheduleSession(sessionId: string, newDate: string) {
  return rescheduleSessionAction(sessionId, newDate);
}

export async function getSessionLogs(bookingId: string) {
  return getSessionLogsAction(bookingId);
}

export async function getSessionsWithDetails(
  options?: Parameters<typeof getSessionsWithDetailsAction>[0]
) {
  return getSessionsWithDetailsAction(options);
}

export async function getCalendarSessions(
  options?: Parameters<typeof getCalendarSessionsAction>[0]
) {
  return getCalendarSessionsAction(options);
}
