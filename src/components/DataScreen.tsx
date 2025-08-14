import React, { useState } from 'react';

const DataScreen: React.FC = () => {
  const [dateRange, setDateRange] = useState('30d');
  const [politicalGroup, setPoliticalGroup] = useState('all');
  const [topic, setTopic] = useState('all');

  // Mock data for charts
  const politicalGroups = [
    { name: 'Progressive Party', count: 45, color: 'bg-blue-500' },
    { name: 'Conservative Union', count: 38, color: 'bg-red-500' },
    { name: 'Green Alliance', count: 22, color: 'bg-green-500' },
    { name: 'Business First', count: 15, color: 'bg-purple-500' },
  ];

  const lawStats = {
    total: 120,
    passed: 78,
    rejected: 23,
    urgent: 19,
  };

  const topicDistribution = [
    { name: 'Education', count: 25, percentage: 21 },
    { name: 'Healthcare', count: 22, percentage: 18 },
    { name: 'Economy', count: 28, percentage: 23 },
    { name: 'Environment', count: 18, percentage: 15 },
    { name: 'Justice', count: 15, percentage: 13 },
    { name: 'Transport', count: 12, percentage: 10 },
  ];

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Data & Insights</h1>
        <p className="text-gray-600">
          Understand parliamentary activity through data and statistics
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="flex-1 input-field text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <select
            value={politicalGroup}
            onChange={(e) => setPoliticalGroup(e.target.value)}
            className="flex-1 input-field text-sm"
          >
            <option value="all">All Parties</option>
            <option value="progressive">Progressive Party</option>
            <option value="conservative">Conservative Union</option>
            <option value="green">Green Alliance</option>
            <option value="business">Business First</option>
          </select>
        </div>
        
        <select
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full input-field text-sm"
        >
          <option value="all">All Topics</option>
          <option value="education">Education</option>
          <option value="health">Healthcare</option>
          <option value="economy">Economy</option>
          <option value="environment">Environment</option>
          <option value="justice">Justice</option>
        </select>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-primary-600 mb-1">
            {lawStats.total}
          </div>
          <div className="text-sm text-gray-600">Total Initiatives</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {lawStats.passed}
          </div>
          <div className="text-sm text-gray-600">Laws Passed</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-600 mb-1">
            {lawStats.rejected}
          </div>
          <div className="text-sm text-gray-600">Laws Rejected</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-orange-600 mb-1">
            {lawStats.urgent}
          </div>
          <div className="text-sm text-gray-600">Urgent Approvals</div>
        </div>
      </div>

      {/* Political Groups Chart */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Initiatives by Political Group</h3>
        <div className="space-y-3">
          {politicalGroups.map((group) => (
            <div key={group.name} className="flex items-center">
              <div className="w-20 text-sm text-gray-600">{group.name}</div>
              <div className="flex-1 mx-3">
                <div className="bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full ${group.color}`}
                    style={{ width: `${(group.count / 120) * 100}%` }}
                  ></div>
                </div>
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 text-right">
                {group.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Topic Distribution */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Distribution by Topic</h3>
        <div className="space-y-3">
          {topicDistribution.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                <span className="text-sm text-gray-700">{item.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{item.count}</span>
                <span className="text-xs text-gray-500">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-gray-700">Digital Education Access Act passed first reading</span>
            <span className="text-gray-500 text-xs">2h ago</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-gray-700">Clean Energy Transition Bill entered committee review</span>
            <span className="text-gray-500 text-xs">1d ago</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-gray-700">Tax Reform Amendment rejected in final vote</span>
            <span className="text-gray-500 text-xs">3d ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataScreen; 