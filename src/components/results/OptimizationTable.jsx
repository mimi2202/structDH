// src/components/results/OptimizationTable.jsx
import React from 'react';
import { FiAward, FiTrendingDown } from 'react-icons/fi';

const OptimizationTable = ({ data }) => {
  const options = Array.isArray(data) ? data : [];

  const formatCurrency = (value) => {
    return value?.toLocaleString('en-GB', { maximumFractionDigits: 0 }) || '0';
  };

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155] overflow-hidden">
      <div className="px-5 py-3 bg-[#f8fafc] dark:bg-[#1e293b] border-b border-[#e2e8f0] dark:border-[#334155]">
        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white uppercase tracking-wide flex items-center">
          <FiTrendingDown className="mr-2" /> Optimization Alternatives
        </h3>
      </div>
      <div className="p-5">
        {options.length === 0 ? (
          <p className="text-center text-[#64748b] dark:text-[#94a3b8] py-6">
            No optimization alternatives available
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] dark:border-[#334155]">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Rank</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Thickness</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Bar</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Spacing</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Cost</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Util. Ratio</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {options.map((option, idx) => {
                  const rank = option?.rank || idx + 1;
                  const thickness = option?.thickness || 0;
                  const barDiameter = option?.bar_diameter || option?.barDiameter || 0;
                  const spacing = option?.spacing || 0;
                  const cost = option?.cost || 0;
                  const utilizationRatio = option?.utilization_ratio || option?.utilizationRatio || 0;
                  const status = option?.status || 'PASS';

                  return (
                    <tr 
                      key={idx} 
                      className={`border-b border-[#e2e8f0] dark:border-[#334155] ${
                        rank === 1 ? 'bg-[#e6f0f5] dark:bg-[#1e3a4a]' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {rank === 1 ? (
                            <FiAward className="text-yellow-500" />
                          ) : (
                            <span className="font-mono text-[#64748b] dark:text-[#94a3b8]">#{rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#0F172A] dark:text-white">{thickness} mm</td>
                      <td className="py-3 px-4 font-mono text-[#0F172A] dark:text-white">Y{barDiameter}</td>
                      <td className="py-3 px-4 font-mono text-[#0F172A] dark:text-white">{spacing} mm</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0F172A] dark:text-white">
                        {formatCurrency(cost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={utilizationRatio <= 1.0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {utilizationRatio.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          status === 'PASS' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                        }`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizationTable;