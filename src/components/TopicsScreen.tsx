import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const TopicsScreen: React.FC = () => {
  const { topics, toggleTopicFollow } = useAppContext();
  const navigate = useNavigate();

  const handleTopicClick = (topicId: string) => {
    navigate(`/topic/${topicId}`);
  };

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Topics</h1>
        <p className="text-gray-600">
          Follow topics to personalize your feed and stay informed
        </p>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="card hover:shadow-md transition-shadow duration-200"
          >
            <div className="text-center mb-3">
              <div className="text-3xl mb-2">{topic.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {topic.name}
              </h3>
              <p className="text-xs text-gray-600 leading-tight mb-3">
                {topic.description}
              </p>
            </div>

            <div className="flex flex-col space-y-2">
              <button
                onClick={() => handleTopicClick(topic.id)}
                className="btn-secondary text-sm py-2"
              >
                View Laws
              </button>
              
              <button
                onClick={() => toggleTopicFollow(topic.id)}
                className={`text-sm py-2 rounded-lg font-medium transition-colors duration-200 ${
                  topic.isFollowed
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {topic.isFollowed ? 'Following' : 'Follow'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Tap on a topic to see related laws and updates</p>
        <p>Follow topics to get personalized notifications</p>
      </div>
    </div>
  );
};

export default TopicsScreen; 