import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const LawDetailScreen: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { laws, toggleLawFollow } = useAppContext();
  
  const law = laws.find(l => l.id === id);

  if (!law) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-gray-500">Law not found</p>
        <button onClick={() => navigate('/feed')} className="btn-primary mt-4">
          Back to Feed
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
          <h1 className="text-xl font-bold text-gray-900">Law Details</h1>
        </div>
      </div>

      {/* Law Header */}
      <div className="card mb-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">
            {law.title}
          </h2>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStageColor(law.stage)}`}>
            {getStageLabel(law.stage)}
          </span>
        </div>
        
        <p className="text-gray-600 mb-4 leading-relaxed">
          {law.description}
        </p>
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <span>Type: {law.type}</span>
            <span>Proposer: {law.proposer}</span>
          </div>
          <span>Last updated: {new Date(law.date).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Follow Button */}
      <div className="mb-6">
        <button
          onClick={() => toggleLawFollow(law.id)}
          className={`w-full py-3 rounded-lg font-medium transition-colors duration-200 ${
            law.isFollowed
              ? 'bg-primary-100 text-primary-700 border border-primary-200'
              : 'btn-primary'
          }`}
        >
          {law.isFollowed ? 'Following' : 'Follow This Law'}
        </button>
      </div>

      {/* Problem Statement */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Problem This Law Addresses</h3>
        <p className="text-gray-700 leading-relaxed">
          {law.problem}
        </p>
      </div>

      {/* Pros and Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-green-700 mb-3 flex items-center">
            <span className="mr-2">✅</span>
            Pros
          </h3>
          <ul className="space-y-2">
            {law.pros.map((pro, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start">
                <span className="text-green-500 mr-2">•</span>
                {pro}
              </li>
            ))}
          </ul>
        </div>
        
        <div className="card">
          <h3 className="font-semibold text-red-700 mb-3 flex items-center">
            <span className="mr-2">❌</span>
            Cons
          </h3>
          <ul className="space-y-2">
            {law.cons.map((con, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start">
                <span className="text-red-500 mr-2">•</span>
                {con}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Support and Opposition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="card">
          <h3 className="font-semibold text-green-700 mb-3">Supporting Parties</h3>
          <div className="space-y-2">
            {law.support.map((party, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">{party}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="card">
          <h3 className="font-semibold text-red-700 mb-3">Opposing Parties</h3>
          <div className="space-y-2">
            {law.opposition.map((party, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm text-gray-700">{party}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Timeline</h3>
        <div className="space-y-4">
          {law.timeline.map((event, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full ${
                  event.status === 'passed' ? 'bg-green-500' :
                  event.status === 'rejected' ? 'bg-red-500' :
                  event.status === 'voting' ? 'bg-purple-500' :
                  event.status === 'debating' ? 'bg-yellow-500' :
                  'bg-blue-500'
                }`}></div>
                {index < law.timeline.length - 1 && (
                  <div className="w-0.5 h-8 bg-gray-300 mt-1"></div>
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{event.event}</div>
                <div className="text-sm text-gray-500">{event.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Official Source */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Official Source</h3>
        <a
          href={law.officialSource}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 text-primary-600 hover:text-primary-700 font-medium"
        >
          <span>View official parliamentary document</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Topics */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">Related Topics</h3>
        <div className="flex flex-wrap gap-2">
          {law.topics.map((topic) => (
            <span
              key={topic}
              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
            >
              {topic}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LawDetailScreen; 