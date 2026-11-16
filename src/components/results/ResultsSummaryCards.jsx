import React from 'react';
import { FiCheckCircle, FiActivity, FiLayers, FiTrendingUp, FiAward } from 'react-icons/fi';

const ResultsSummaryCards = ({ data }) => {
  const summary = data.designSummary;
  
  const cards = [
    {
      title: 'Slab Configuration',
      value: `${summary.thickness}mm Thick`,
      subtitle: `${summary.spanLx}m × ${summary.spanLy}m • ${summary.slabType}`,
      icon: FiLayers,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Reinforcement',
      value: `Y${summary.selectedBarDiameter} @ ${summary.selectedSpacing}mm`,
      subtitle: `${summary.concreteGrade} / ${summary.steelGrade}`,
      icon: FiActivity,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Utilization Ratio',
      value: `${summary.utilizationRatio.toFixed(2)}`,
      subtitle: 'Overall Design Ratio',
      icon: FiTrendingUp,
      color: summary.utilizationRatio <= 1.0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
      bg: summary.utilizationRatio <= 1.0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <div key={idx} className="bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155] p-5">
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
              {card.title}
            </span>
            <div className={`p-2 rounded-lg ${card.bg}`}>
              <card.icon className={`text-lg ${card.color}`} />
            </div>
          </div>
          <p className="text-xl font-bold text-[#0F172A] dark:text-white mb-1">
            {card.value}
          </p>
          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
            {card.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ResultsSummaryCards;