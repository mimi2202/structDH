// src/pages/ResultsDashboard.jsx
import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FiCheckCircle, FiAlertTriangle, FiXCircle, FiTrendingUp,
  FiBarChart2, FiActivity, FiFileText,
  FiDownload, FiShare2, FiGrid, FiLayers, FiArrowLeft
} from 'react-icons/fi';
import ResultsSummaryCards from '../components/results/ResultsSummaryCards';
import DesignForcesTable from '../components/results/DesignForcesTable';
import ReinforcementDetails from '../components/results/ReinforcementDetails';
import DeflectionPlot from '../components/results/DeflectionPlot';
import ComplianceChecks from '../components/results/ComplianceChecks';
import SFD_BMD_Graphs from '../components/results/SFD_BMD_Graphs';

const ResultsDashboard = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeTab, setActiveTab] = useState('summary');
  
  // Get real data from backend (passed via navigation state)
  const rawData = location.state?.designResult;
  
  // If no data, show error
  if (!rawData) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="text-6xl text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-2">No Design Results</h2>
          <p className="text-[#64748b] dark:text-[#94a3b8] mb-6">Please run a design optimisation first.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors"
          >
            <FiArrowLeft className="inline mr-2" /> Back to Design
          </button>
        </div>
      </div>
    );
  }

  // Map backend data to component props
  const resultsData = {
    status: rawData.summary?.status || 'PASS',
    designSummary: {
      slabType: rawData.summary?.slab_type || 'Two-Way Slab',
      continuity: rawData.summary?.continuity || 'All Edges Continuous',
      spanLx: rawData.summary?.span_lx || 4.0,
      spanLy: rawData.summary?.span_ly || 5.0,
      thickness: rawData.summary?.thickness || 175,
      effectiveDepth: rawData.summary?.effective_depth || 150,
      concreteGrade: rawData.summary?.concrete_grade || 'C30/37',
      steelGrade: rawData.summary?.steel_grade || 'B500',
      selectedBarDiameter: rawData.summary?.selected_bar_diameter || 12,
      selectedSpacing: rawData.summary?.selected_spacing || 150,
      totalCost: rawData.summary?.total_cost || 0,
      optimizationRank: rawData.summary?.optimization_rank || 1,
      utilizationRatio: rawData.summary?.utilization_ratio || 0.85,
    },
    designForces: {
      maxSaggingMoment: rawData.design_forces?.max_sagging_moment || 0,
      maxHoggingMoment: rawData.design_forces?.max_hogging_moment || 0,
      maxShearForce: rawData.design_forces?.max_shear_force || 0,
      ultimateLoad: rawData.design_forces?.ultimate_load || 0,
      serviceLoad: rawData.design_forces?.service_load || 0,
    },
    reinforcement: {
      bottomSteel: rawData.reinforcement?.bottom_steel || {},
      topSteel: rawData.reinforcement?.top_steel || {},
    },
    deflection: rawData.deflection || {},
    shear: rawData.shear || {},
    compliance: rawData.compliance || [],
    costBreakdown: rawData.cost_breakdown || {},
    optimizationOptions: rawData.optimization_options || [],
  };

  const tabs = [
    { id: 'summary', label: 'Summary', icon: FiGrid },
    { id: 'designForces', label: 'Design Forces', icon: FiActivity },
    { id: 'reinforcement', label: 'Reinforcement', icon: FiLayers },
    { id: 'checks', label: 'Code Checks', icon: FiCheckCircle },
    { id: 'graphs', label: 'Graphs', icon: FiBarChart2 },
  ];

  const getStatusIcon = (status) => {
    switch(status) {
      case 'PASS': return <FiCheckCircle className="text-green-600 dark:text-green-400" />;
      case 'WARNING': return <FiAlertTriangle className="text-yellow-600 dark:text-yellow-400" />;
      case 'FAIL': return <FiXCircle className="text-red-600 dark:text-red-400" />;
      default: return <FiCheckCircle className="text-gray-600 dark:text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'PASS': return 'text-green-600 dark:text-green-400';
      case 'WARNING': return 'text-yellow-600 dark:text-yellow-400';
      case 'FAIL': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <button
                  onClick={() => navigate(-1)}
                  className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#1f2937] transition-colors"
                >
                  <FiArrowLeft className="text-[#64748b] dark:text-[#94a3b8]" />
                </button>
                <h1 className="text-2xl font-bold text-[#0F172A] dark:text-white">
                  Design Results
                </h1>
              </div>
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                Slab Design Optimization • EN 1992-1-1 (EC2) • Powered by Sphere Design Hub Engine
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button className="flex items-center space-x-2 px-4 py-2 bg-[#0A2F44] text-white rounded-lg hover:bg-[#082636] transition-colors text-sm font-medium shadow-md">
                <FiDownload className="text-sm" />
                <span>Export PDF</span>
              </button>
              <button className="flex items-center space-x-2 px-4 py-2 border border-[#e2e8f0] dark:border-[#334155] rounded-lg text-[#475569] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#334155] transition-colors text-sm">
                <FiShare2 className="text-sm" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <div className={`mb-8 p-4 rounded-xl border-2 ${
          resultsData.status === 'PASS' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-500' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-500'
        }`}>
          <div className="flex items-center space-x-3">
            {getStatusIcon(resultsData.status)}
            <div>
              <p className={`text-lg font-bold ${getStatusColor(resultsData.status)}`}>
                {resultsData.status === 'PASS' ? '✅ Design Passed - All Checks Satisfied' : '❌ Design Failed - Review Required'}
              </p>
              <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                Utilization Ratio: {resultsData.designSummary.utilizationRatio.toFixed(2)} • 
                Selected: {resultsData.designSummary.thickness}mm slab, Y{resultsData.designSummary.selectedBarDiameter} @ {resultsData.designSummary.selectedSpacing}mm c/c
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white dark:bg-[#1f2937] rounded-lg p-1 border border-[#e2e8f0] dark:border-[#334155]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#0A2F44] text-white shadow-md'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#334155]'
                }`}
              >
                <tab.icon className="text-sm" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Content */}
        <div className="space-y-6">
          {activeTab === 'summary' && <ResultsSummaryCards data={resultsData} />}
          {activeTab === 'designForces' && (
            <>
              <DesignForcesTable data={resultsData.designForces} />
              <SFD_BMD_Graphs data={resultsData.designForces} />
            </>
          )}
          {activeTab === 'reinforcement' && <ReinforcementDetails data={resultsData.reinforcement} />}
          {activeTab === 'checks' && (
            <>
              <ComplianceChecks data={resultsData.compliance} />
              <DeflectionPlot data={resultsData.deflection} />
            </>
          )}
          {activeTab === 'graphs' && (
            <>
              <SFD_BMD_Graphs data={resultsData.designForces} />
              <DeflectionPlot data={resultsData.deflection} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultsDashboard;