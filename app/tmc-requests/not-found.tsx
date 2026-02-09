'use client';

export default function TmcRequestsNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 shadow-lg rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
          <span className="text-3xl font-bold text-gray-400">404</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Раздел заявок: страница не найдена
        </h1>

        <p className="text-gray-600 dark:text-slate-400 mb-6">
          Запрашиваемая страница в разделе заявок не существует или была перемещена.
        </p>

        <div className="flex gap-3 justify-center">
          <a
            href="/tmc-requests/incoming"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-block"
          >
            ← Входящие заявки
          </a>
          <a
            href="/tmc-requests/outgoing"
            className="px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 rounded-md hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors inline-block"
          >
            Исходящие заявки
          </a>
        </div>
      </div>
    </div>
  );
}
