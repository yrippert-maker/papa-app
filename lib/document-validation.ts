/**
 * FR-1.3: Сервис валидации документов по правилам оформления.
 * Проверяет draftFields и extractedFromImage на соответствие брендбуку и нормам.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field?: string;
  code: string;
  message: string;
  severity: ValidationSeverity;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  rulesApplied: string[];
}

const BRANDBOOK_PATH = join(process.cwd(), 'config', 'mura-menasa-brandbook.json');

interface BrandbookConfig {
  company?: string;
  documentRules?: string[];
  templates?: { firmBlank?: string };
}

function loadBrandbook(): BrandbookConfig | null {
  if (!existsSync(BRANDBOOK_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BRANDBOOK_PATH, 'utf-8')) as BrandbookConfig;
  } catch {
    return null;
  }
}

/** Проверка обязательных полей для акта (АВК/АВыхК). */
function validateActFields(fields: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = [
    'act_number',
    'act_date',
    'serial_number',
    'inspector',
    'approver',
    'decision',
  ] as const;
  for (const key of required) {
    const val = fields[key];
    if (val == null || String(val).trim() === '') {
      issues.push({
        field: key,
        code: 'REQUIRED_FIELD',
        message: `Обязательное поле "${key}" не заполнено`,
        severity: 'error',
      });
    }
  }
  const actNumber = String(fields.act_number ?? '').trim();
  if (actNumber && !/^[A-Z0-9\-/]+$/i.test(actNumber)) {
    issues.push({
      field: 'act_number',
      code: 'FORMAT',
      message: 'Номер акта должен содержать буквы, цифры, дефис или слэш',
      severity: 'warning',
    });
  }
  const actDate = String(fields.act_date ?? '').trim();
  if (actDate && !/^\d{4}-\d{2}-\d{2}$/.test(actDate)) {
    issues.push({
      field: 'act_date',
      code: 'FORMAT',
      message: 'Дата акта должна быть в формате ГГГГ-ММ-ДД',
      severity: 'warning',
    });
  }
  return issues;
}

/** Проверка полей для техкарты. */
function validateTechcardFields(fields: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = ['operation', 'product', 'version', 'approval'] as const;
  for (const key of required) {
    const val = fields[key];
    if (val == null || String(val).trim() === '') {
      issues.push({
        field: key,
        code: 'REQUIRED_FIELD',
        message: `Обязательное поле "${key}" не заполнено`,
        severity: 'error',
      });
    }
  }
  const version = String(fields.version ?? '').trim();
  if (version && !/^\d+\.\d+/.test(version)) {
    issues.push({
      field: 'version',
      code: 'FORMAT',
      message: 'Версия должна быть в формате X.Y (например 1.0)',
      severity: 'warning',
    });
  }
  return issues;
}

/** Проверка полей бланка фирмы (mura-menasa-firm-blank). */
function validateFirmBlankFields(fields: Record<string, unknown>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const required = ['recipient', 'subject'] as const;
  for (const key of required) {
    const val = fields[key];
    if (val == null || String(val).trim() === '') {
      issues.push({
        field: key,
        code: 'REQUIRED_FIELD',
        message: `Обязательное поле "${key}" не заполнено`,
        severity: 'error',
      });
    }
  }
  if (fields.org_name !== 'MURA MENASA FZCO') {
    issues.push({
      field: 'org_name',
      code: 'BRANDING',
      message: 'Документ должен быть оформлен от имени MURA MENASA FZCO',
      severity: 'warning',
      suggestion: 'MURA MENASA FZCO',
    });
  }
  return issues;
}

/**
 * Валидирует draftFields по intent и правилам брендбука.
 */
export function validateDocument(
  intent: 'act' | 'techcard' | 'mura-menasa-firm-blank' | 'letter' | 'report' | 'memo',
  draftFields: Record<string, unknown>,
  documentRules?: string[]
): ValidationResult {
  const rulesApplied: string[] = [];
  const brandbook = loadBrandbook();
  if (brandbook?.documentRules?.length) {
    rulesApplied.push(...brandbook.documentRules);
  }
  if (documentRules?.length) {
    rulesApplied.push(...documentRules);
  }
  rulesApplied.push('REQ:EASA-145.A.50', 'AП-145', 'MOPM Mura Menasa');

  let issues: ValidationIssue[] = [];

  switch (intent) {
    case 'act':
      issues = validateActFields(draftFields);
      break;
    case 'techcard':
      issues = validateTechcardFields(draftFields);
      break;
    case 'mura-menasa-firm-blank':
      issues = validateFirmBlankFields(draftFields);
      break;
    default:
      // letter, report, memo — базовая проверка
      if (!draftFields.org_name || String(draftFields.org_name).trim() === '') {
        issues.push({
          field: 'org_name',
          code: 'REQUIRED_FIELD',
          message: 'Укажите организацию',
          severity: 'warning',
        });
      }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return {
    valid: !hasErrors,
    issues,
    rulesApplied: [...new Set(rulesApplied)],
  };
}
