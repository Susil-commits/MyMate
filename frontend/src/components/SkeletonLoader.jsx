import React from 'react';

export const SkeletonCard = () => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      </div>
      <div className="mt-6 flex justify-between items-center">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </div>
    </div>
  );
};

export const SkeletonProfile = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 border border-gray-100 dark:border-gray-700">
        <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700"></div>
        <div className="flex-1 space-y-4 py-2">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="flex gap-3 mt-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-48 bg-gray-200 dark:bg-gray-700"></div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-64 bg-gray-200 dark:bg-gray-700"></div>
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-64 bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </div>
    </div>
  );
};

export const SkeletonList = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};
