/**
 * Бинарный тест 500: рендер без auth.
 * GET /dev-home → если OK, проблема в auth/middleware.
 * Если 500 — проблема в layout/page.
 */
import Home from '../page';

export default function DevHomePage() {
  return <Home />;
}
