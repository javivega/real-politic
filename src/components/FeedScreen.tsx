import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const FeedScreen: React.FC = () => {
  const { laws, selectedTopics } = useAppContext();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Filter laws based on selected topics
  const filteredLaws = laws.filter(law => 
    selectedTopics.length === 0 || 
    law.topics.some(topic => selectedTopics.includes(topic))
  );

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'proposed': return 'bg-blue-100 text-blue-800';
      case 'debating': return 'bg-yellow-100 text-yellow-800';
      case 'voting': return 'bg-purple-100 text-purple-800';
      case 'passed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case 'proposed': return 'Proposed';
      case 'debating': return 'Debating';
      case 'voting': return 'Voting';
      case 'passed': return 'Passed';
      case 'rejected': return 'Rejected';
      default: return stage;
    }
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'proposed', label: 'Proposed' },
    { id: 'debating', label: 'Debating' },
    { id: 'voting', label: 'Voting' },
    { id: 'passed', label: 'Passed' },
    { id: 'rejected', label: 'Rejected' },
  ];

  const filteredByStage = activeFilter === 'all' 
    ? filteredLaws 
    : filteredLaws.filter(law => law.stage === activeFilter);

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Feed</h1>
        <p className="text-gray-600">
          Personalized updates on laws that matter to you
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                activeFilter === filter.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trending Section */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">🔥 Trending</h2>
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Clean Energy Transition Bill</h3>
              <p className="text-sm text-gray-600">Currently being debated in Parliament</p>
            </div>
            <div className="text-2xl">⚡</div>
          </div>
        </div>
      </div>

      {/* Laws List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Laws</h2>
        {filteredByStage.map((law) => (
          <div
            key={law.id}
            onClick={() => navigate(`/law/${law.id}`)}
            className="card cursor-pointer hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-900 text-lg leading-tight">
                {law.title}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStageColor(law.stage)}`}>
                {getStageLabel(law.stage)}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-3 leading-relaxed">
              {law.description}
            </p>
            
            <div className="flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-2">
                <span>{law.type}</span>
                <span>•</span>
                <span>{law.proposer}</span>
              </div>
              <span>{new Date(law.date).toLocaleDateString()}</span>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-3">
              {law.topics.map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        ))}
        
        {filteredByStage.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No laws found for the selected filter.</p>
            <p className="text-sm">Try selecting different topics or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedScreen; 