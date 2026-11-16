// src/components/results/CostBreakdown.jsx
import React from 'react';
import { FiDollarSign } from 'react-icons/fi';

const CostBreakdown = ({ data }) => {
  // Handle both backend snake_case and frontend camelCase
  const concrete = data?.concrete || {};
  const steel = data?.steel || {};
  const formwork = data?.formwork || {};
  const total = data?.total || 0;
  const totalPerSqm = data?.total_per_sqm || data?.totalPerSqm || 0;

  const concreteVolume = concrete?.volume || 0;
  const concreteRate = concrete?.rate || 0;
  const concreteCost = concrete?.cost || 0;
  
  const steelWeight = steel?.weight || 0;
  const steelRate = steel?.rate || 0;
  const steelCost = steel?.cost || 0;
  
  const formworkArea = formwork?.area || 0;
  const formworkRate = formwork?.rate || 0;
  const formworkCost = formwork?.cost || 0;

  const formatCurrency = (value) => {
    return value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow-sm border border-[#e2e8f0] dark:border-[#334155] overflow-hidden">
      <div className="px-5 py-3 bg-[#f8fafc] dark:bg-[#1e293b] border-b border-[#e2e8f0] dark:border-[#334155]">
        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white uppercase tracking-wide">
          Cost Breakdown
        </h3>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-gray-50 dark:bg-[#1e293b] rounded-lg">
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1">Concrete</p>
            <p className="text-xl font-bold text-[#0F172A] dark:text-white">
              {formatCurrency(concreteCost)}
            </p>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              {concreteVolume.toFixed(2)} m³ × {formatCurrency(concreteRate)}/m³
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#1e293b] rounded-lg">
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1">Steel</p>
            <p className="text-xl font-bold text-[#0F172A] dark:text-white">
              {formatCurrency(steelCost)}
            </p>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              {steelWeight.toFixed(1)} kg × {formatCurrency(steelRate)}/kg
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#1e293b] rounded-lg">
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-1">Formwork</p>
            <p className="text-xl font-bold text-[#0F172A] dark:text-white">
              {formatCurrency(formworkCost)}
            </p>
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
              {formworkArea.toFixed(1)} m² × {formatCurrency(formworkRate)}/m²
            </p>
          </div>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-[#0A2F44]/10 to-[#2E7D32]/10 dark:from-[#0A2F44]/20 dark:to-[#2E7D32]/20 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-lg font-bold text-[#0A2F44] dark:text-[#66a4c2]">
                Total Cost: {formatCurrency(total)}
              </p>
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                Per m²: {formatCurrency(totalPerSqm)}
              </p>
            </div>
            <div className="w-12 h-12 bg-[#0A2F44] rounded-full flex items-center justify-center">
              <FiDollarSign className="text-white text-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostBreakdown;