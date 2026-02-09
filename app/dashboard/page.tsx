import { redirect } from 'next/navigation';

/**
 * Алиас: /dashboard → /
 * Дашборд — корневая страница. Сохраняем совместимость со ссылками /dashboard.
 */
export default function DashboardPage() {
  redirect('/');
}
