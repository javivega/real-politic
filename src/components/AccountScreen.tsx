import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

const AccountScreen: React.FC = () => {
  const { user, topics, updateUser } = useAppContext();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    topicUpdates: true,
    lawUpdates: true,
  });

  // Mock user data
  const mockUser = {
    id: 'user-001',
    name: 'Alex Johnson',
    email: 'alex.johnson@email.com',
    selectedTopics: ['education', 'health', 'environment'],
    followedLaws: ['law-001', 'law-002'],
    notificationSettings: notifications,
  };

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSignOut = () => {
    // In a real app, this would clear auth tokens and redirect
    console.log('Signing out...');
  };

  const followedTopics = topics.filter(topic => 
    mockUser.selectedTopics.includes(topic.id)
  );

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account</h1>
        <p className="text-gray-600">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile Section */}
      <div className="card mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-2xl text-white font-bold">
              {mockUser.name.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{mockUser.name}</h2>
            <p className="text-gray-600">{mockUser.email}</p>
          </div>
        </div>
        
        <button className="btn-secondary w-full">
          Edit Profile
        </button>
      </div>

      {/* Followed Topics */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Your Topics</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {followedTopics.map((topic) => (
            <div
              key={topic.id}
              className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg"
            >
              <span className="text-xl">{topic.icon}</span>
              <span className="text-sm font-medium text-gray-700">{topic.name}</span>
            </div>
          ))}
        </div>
        <button className="btn-secondary w-full">
          Edit Topics
        </button>
      </div>

      {/* Notification Settings */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Email Notifications</div>
              <div className="text-sm text-gray-600">Receive updates via email</div>
            </div>
            <button
              onClick={() => handleNotificationToggle('email')}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                notifications.email ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  notifications.email ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Push Notifications</div>
              <div className="text-sm text-gray-600">Receive push notifications</div>
            </div>
            <button
              onClick={() => handleNotificationToggle('push')}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                notifications.push ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  notifications.push ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Topic Updates</div>
              <div className="text-sm text-gray-600">When followed topics have new laws</div>
            </div>
            <button
              onClick={() => handleNotificationToggle('topicUpdates')}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                notifications.topicUpdates ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  notifications.topicUpdates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900">Law Updates</div>
              <div className="text-sm text-gray-600">When followed laws change status</div>
            </div>
            <button
              onClick={() => handleNotificationToggle('lawUpdates')}
              className={`w-12 h-6 rounded-full transition-colors duration-200 ${
                notifications.lawUpdates ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                  notifications.lawUpdates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* App Settings */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">App Settings</h3>
        <div className="space-y-3">
          <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
            <div className="font-medium text-gray-900">Privacy Policy</div>
            <div className="text-sm text-gray-600">Read our privacy policy</div>
          </button>
          
          <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
            <div className="font-medium text-gray-900">Terms of Service</div>
            <div className="text-sm text-gray-600">Read our terms of service</div>
          </button>
          
          <button className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors duration-200">
            <div className="font-medium text-gray-900">Help & Support</div>
            <div className="text-sm text-gray-600">Get help and contact support</div>
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="mb-6">
        <button
          onClick={handleSignOut}
          className="w-full py-4 px-6 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors duration-200"
        >
          Sign Out
        </button>
      </div>

      {/* App Version */}
      <div className="text-center text-xs text-gray-500">
        <p>Real Politic v0.1.0</p>
        <p>Making democracy accessible to everyone</p>
      </div>
    </div>
  );
};

export default AccountScreen; 