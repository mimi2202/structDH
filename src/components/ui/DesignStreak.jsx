import React from 'react';
import { FiTrendingUp, FiCalendar } from 'react-icons/fi';
import { streaks } from '../../utils/activity';

// Days in a row with at least one design calculation (from the activity log
// written by services/api.js). It used to count days the dashboard was opened.
const DesignStreak = ({ days }) => {
  const { current, longest, activeToday } = streaks(days || {});

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-lg p-6 border border-[#e5e7eb] dark:border-[#374151]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <FiTrendingUp className="text-orange-600 dark:text-orange-400 text-xl" />
          </div>
          <h3 className="font-semibold text-[#02090d] dark:text-white">Daily Streak</h3>
        </div>
        <FiCalendar className="text-[#6b7280] dark:text-[#9ca3af]" />
      </div>

      <div className="text-3xl font-bold text-[#02090d] dark:text-white mb-2">
        {current} {current === 1 ? 'day' : 'days'}
      </div>
      <p className="text-sm text-[#6b7280] dark:text-[#9ca3af]">
        Consecutive days with a design · longest {longest} {longest === 1 ? 'day' : 'days'}
      </p>

      <p className="text-xs text-[#9ca3af] dark:text-[#6b7280] mt-3">
        {current > 0 && !activeToday
          ? 'Run a design today to keep the streak going.'
          : 'Streak resets if you miss a day.'}
      </p>
    </div>
  );
};

export default DesignStreak;
