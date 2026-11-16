import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiDownload, FiMonitor, FiCheckCircle } from 'react-icons/fi';
import { FaWindows, FaApple, FaLinux } from 'react-icons/fa';

const SDHAgentDownload = () => {
  const platforms = [
    { name: 'Windows', icon: FaWindows, url: '#', version: 'v2.1.0', size: '45MB' },
    { name: 'macOS', icon: FaApple, url: '#', version: 'v2.1.0', size: '52MB' },
    { name: 'Linux', icon: FaLinux, url: '#', version: 'v2.1.0', size: '48MB' },
  ];

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#111827] py-12">
      <div className="max-w-3xl mx-auto px-4">
        <Link to="/external-design" className="inline-flex items-center text-sm text-[#0A2F44] dark:text-[#66a4c2] hover:underline mb-6">
          <FiArrowLeft className="mr-2" /> Back
        </Link>
        
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-[#0A2F44] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiDownload className="text-white text-3xl" />
            </div>
            <h1 className="text-2xl font-bold text-[#02090d] dark:text-white">Download SDH Agent</h1>
            <p className="text-[#6b7280] dark:text-[#9ca3af] mt-2">Connect Sphere Design Hub with your external design tools</p>
          </div>
          
          <div className="space-y-4">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              return (
                <a
                  key={platform.name}
                  href={platform.url}
                  className="flex items-center justify-between p-4 border border-[#e5e7eb] dark:border-[#374151] rounded-xl hover:bg-[#f9fafb] dark:hover:bg-[#374151] transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <Icon className="text-2xl text-[#0A2F44]" />
                    <div>
                      <h3 className="font-semibold text-[#02090d] dark:text-white">{platform.name}</h3>
                      <p className="text-xs text-[#6b7280] dark:text-[#9ca3af]">{platform.version} • {platform.size}</p>
                    </div>
                  </div>
                  <FiDownload className="text-[#0A2F44]" />
                </a>
              );
            })}
          </div>
          
          <div className="mt-8 p-4 bg-[#e6f0f5] dark:bg-[#1e3a4a] rounded-xl">
            <div className="flex items-start space-x-3">
              <FiCheckCircle className="text-green-600 dark:text-green-400 mt-0.5" />
              <div>
                <h4 className="font-medium text-[#02090d] dark:text-white">Installation Instructions</h4>
                <ol className="text-sm text-[#6b7280] dark:text-[#9ca3af] mt-2 space-y-1 list-decimal list-inside">
                  <li>Download the SDH Agent for your operating system</li>
                  <li>Run the installer and follow the setup wizard</li>
                  <li>Launch SDH Agent from your applications</li>
                  <li>Return to Sphere Design Hub and click "Check Status"</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SDHAgentDownload;