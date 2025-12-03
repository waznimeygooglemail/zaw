import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = "text-primary-500" }) => {
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-center shadow-lg border border-gray-700">
      <div className={`w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center mr-3 ${color}`}>
        <i className={`${icon} text-lg`}></i>
      </div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-white font-mono">{value}</p>
      </div>
    </div>
  );
};
