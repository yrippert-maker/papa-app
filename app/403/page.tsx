'use client';

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
          <span className="text-3xl font-bold text-amber-600">403</span>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Доступ запрещён
        </h1>

        <p className="text-gray-600 mb-6">
          У вас нет прав для просмотра этой страницы.
        </p>

        <a
          href="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-block"
        >
          На главную
        </a>
      </div>
    </div>
  );
}
