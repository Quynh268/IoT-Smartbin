import React from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]} flex items-start justify-between transition-transform hover:scale-105 duration-200`}>
      <div>
        <p className="text-xs font-semibold uppercase opacity-70 mb-1">{title}</p>
        <h3 className="text-2xl font-bold">{value}</h3>
        {trend && <p className="text-xs mt-1 opacity-80">{trend}</p>}
      </div>
      <div className={`p-2 rounded-lg bg-white bg-opacity-60 shadow-sm`}>
        {icon}
      </div>
    </div>
  );
};

export default StatsCard;
