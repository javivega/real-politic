import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const TopicDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { topics, laws, toggleTopicFollow } = useAppContext();
  
  const topic = topics.find(t => t.id === id);
  const relatedLaws = laws.filter(law => law.topics.includes(id || ''));

  if (!topic) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-gray-500">Topic not found</p>
        <button onClick={() => navigate('/topics')} className="btn-primary mt-4">
          Back to Topics
        </button>
      </div>
    );
  }

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

  return (
    <div className="px-4 py-6">
      {/* Header with Back Button */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Topic Details</h1>
        </div>
      </div>

      {/* Topic Header */}
      <div className="card mb-6">
        <div className="text-center mb-4">
          <div className="text-4xl mb-3">{topic.icon}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{topic.name}</h2>
          <p className="text-gray-600 leading-relaxed">
            {topic.description}
          </p>
        </div>
        
        <button
          onClick={() => toggleTopicFollow(topic.id)}
          className={`w-full py-3 rounded-lg font-medium transition-colors duration-200 ${
            topic.isFollowed
              ? 'bg-primary-100 text-primary-700 border border-primary-200'
              : 'btn-primary'
          }`}
        >
          {topic.isFollowed ? 'Following' : 'Follow This Topic'}
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-primary-600 mb-1">
            {relatedLaws.length}
          </div>
          <div className="text-sm text-gray-600">Related Laws</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {relatedLaws.filter(law => law.stage === 'passed').length}
          </div>
          <div className="text-sm text-gray-600">Laws Passed</div>
        </div>
      </div>

      {/* Related Laws */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Laws Related to {topic.name}
        </h3>
        
        {relatedLaws.length > 0 ? (
          <div className="space-y-4">
            {relatedLaws.map((law) => (
              <div
                key={law.id}
                onClick={() => navigate(`/law/${law.id}`)}
                className="card cursor-pointer hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-semibold text-gray-900 leading-tight">
                    {law.title}
                  </h4>
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
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No laws found for this topic yet.</p>
            <p className="text-sm">Check back later for updates.</p>
          </div>
        )}
      </div>

      {/* Topic Insights */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Topic Insights</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Most active political party</span>
            <span className="font-medium text-gray-900">Progressive Party</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Average time to pass</span>
            <span className="font-medium text-gray-900">45 days</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Success rate</span>
            <span className="font-medium text-gray-900">78%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Last updated</span>
            <span className="font-medium text-gray-900">2 days ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicDetailScreen; 