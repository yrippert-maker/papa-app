import { join } from 'path';

/**
 * Конфигурация ПАПА. Workspace — корень хранения данных.
 * В production обязательно задать WORKSPACE_ROOT.
 */
function getWorkspaceRoot(): string {
  const fromEnv = process.env.WORKSPACE_ROOT?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), 'data');
}

export const WORKSPACE_ROOT = getWorkspaceRoot();
export const DB_RELATIVE = '00_SYSTEM/db/papa.sqlite';
export const DB_PATH = `${WORKSPACE_ROOT}/${DB_RELATIVE}`;

/** Проверка: задан ли workspace явно (для предупреждений при старте). */
export const WORKSPACE_IS_EXPLICIT = Boolean(process.env.WORKSPACE_ROOT?.trim());
