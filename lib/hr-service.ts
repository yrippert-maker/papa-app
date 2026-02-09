/**
 * HR Service — FR-5.2–5.5: обучение, экзамены, отпуска, связь с ролями.
 * Хранение в JSON (data/00_SYSTEM/hr/).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { nanoid } from 'nanoid';

const HR_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'hr');

export type HrTraining = {
  id: string;
  program: string;
  employee: string;
  employeeEmail?: string;
  role?: string;
  date: string;
  cert?: string;
  createdAt: string;
};

export type HrExam = {
  id: string;
  competency: string;
  employee: string;
  employeeEmail?: string;
  role?: string;
  result: string;
  validUntil: string;
  createdAt: string;
};

export type HrVacation = {
  id: string;
  employee: string;
  employeeEmail?: string;
  role?: string;
  start: string;
  end: string;
  status: 'Заявка' | 'Утверждён' | 'Отклонён';
  createdAt: string;
};

function ensureDir(): void {
  if (!existsSync(HR_DIR)) mkdirSync(HR_DIR, { recursive: true });
}

function loadJson<T>(file: string, defaultVal: T): T {
  ensureDir();
  const p = join(HR_DIR, file);
  if (!existsSync(p)) return defaultVal;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return defaultVal;
  }
}

function saveJson<T>(file: string, data: T): void {
  ensureDir();
  writeFileSync(join(HR_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

const TRAINING_FILE = 'training.json';
const EXAMS_FILE = 'exams.json';
const VACATIONS_FILE = 'vacations.json';

export function listTraining(): HrTraining[] {
  const items = loadJson<HrTraining[]>(TRAINING_FILE, []);
  return Array.isArray(items) ? items : [];
}

export function addTraining(item: Omit<HrTraining, 'id' | 'createdAt'>): HrTraining {
  const items = listTraining();
  const newItem: HrTraining = {
    ...item,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  saveJson(TRAINING_FILE, items);
  return newItem;
}

export function listExams(): HrExam[] {
  const items = loadJson<HrExam[]>(EXAMS_FILE, []);
  return Array.isArray(items) ? items : [];
}

export function addExam(item: Omit<HrExam, 'id' | 'createdAt'>): HrExam {
  const items = listExams();
  const newItem: HrExam = {
    ...item,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  saveJson(EXAMS_FILE, items);
  return newItem;
}

export function listVacations(): HrVacation[] {
  const items = loadJson<HrVacation[]>(VACATIONS_FILE, []);
  return Array.isArray(items) ? items : [];
}

export function addVacation(item: Omit<HrVacation, 'id' | 'createdAt'>): HrVacation {
  const items = listVacations();
  const newItem: HrVacation = {
    ...item,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  items.push(newItem);
  saveJson(VACATIONS_FILE, items);
  return newItem;
}

export function updateVacationStatus(id: string, status: HrVacation['status']): HrVacation | null {
  const items = listVacations();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  items[idx].status = status;
  saveJson(VACATIONS_FILE, items);
  return items[idx];
}

/** FR-5.4: Табель рабочего времени */
export type HrTimesheet = {
  id: string;
  employee: string;
  employeeEmail?: string;
  role?: string;
  date: string;
  hours: number;
  activity?: string;
  project?: string;
  createdAt: string;
};

const TIMESHEET_FILE = 'timesheet.json';

export function listTimesheet(filters?: { employee?: string; from?: string; to?: string }): HrTimesheet[] {
  let items = loadJson<HrTimesheet[]>(TIMESHEET_FILE, []);
  if (!Array.isArray(items)) items = [];
  if (filters?.employee) {
    items = items.filter((i) => i.employee.toLowerCase().includes(filters!.employee!.toLowerCase()));
  }
  if (filters?.from) {
    items = items.filter((i) => i.date >= filters!.from!);
  }
  if (filters?.to) {
    items = items.filter((i) => i.date <= filters!.to!);
  }
  return items.sort((a, b) => b.date.localeCompare(a.date));
}

export function addTimesheet(item: Omit<HrTimesheet, 'id' | 'createdAt'>): HrTimesheet {
  const items = loadJson<HrTimesheet[]>(TIMESHEET_FILE, []);
  const arr = Array.isArray(items) ? items : [];
  const newItem: HrTimesheet = {
    ...item,
    id: nanoid(),
    createdAt: new Date().toISOString(),
  };
  arr.push(newItem);
  saveJson(TIMESHEET_FILE, arr);
  return newItem;
}
