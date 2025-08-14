import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

interface TopicSelectionScreenProps {
  onComplete: () => void;
}

const TopicSelectionScreen: React.FC<TopicSelectionScreenProps> = ({ onComplete }) => {
  const { topics, updateSelectedTopics } = useAppContext();
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  const handleTopicToggle = (topicId: string) => {
    setSelectedTopics(prev => {
      if (prev.includes(topicId)) {
        return prev.filter(id => id !== topicId);
      } else {
        return [...prev, topicId];
      }
    });
  };

  const handleContinue = () => {
    if (selectedTopics.length >= 3) {
      updateSelectedTopics(selectedTopics);
      onComplete();
    }
  };

  const canContinue = selectedTopics.length >= 3;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Your Interests
        </h1>
        <p className="text-gray-600">
          Select at least 3 topics to personalize your feed
        </p>
        <div className="mt-2 text-sm text-gray-500">
          {selectedTopics.length}/3 selected
        </div>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {topics.map((topic) => (
          <div
            key={topic.id}
            onClick={() => handleTopicToggle(topic.id)}
            className={`card cursor-pointer transition-all duration-200 ${
              selectedTopics.includes(topic.id)
                ? 'ring-2 ring-primary-500 bg-primary-50 border-primary-200'
                : 'hover:shadow-md'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl mb-2">{topic.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">
                {topic.name}
              </h3>
              <p className="text-xs text-gray-600 leading-tight">
                {topic.description}
              </p>
              {selectedTopics.includes(topic.id) && (
                <div className="mt-2">
                  <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Continue Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className={`w-full py-4 rounded-lg font-medium transition-all duration-200 ${
            canContinue
              ? 'btn-primary'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canContinue ? 'Continue' : 'Select 3 Topics'}
        </button>
      </div>
    </div>
  );
};

export default TopicSelectionScreen; 