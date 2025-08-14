import React from 'react';

interface SplashScreenProps {
  onContinue: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onContinue }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* App Logo */}
        <div className="mb-8">
          <div className="w-24 h-24 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl text-white font-bold">RP</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Real Politic
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Understand Parliament in Plain Language
          </p>
        </div>

        {/* App Description */}
        <div className="mb-12 text-gray-700 space-y-3">
          <p className="text-sm">
            Get clear, simple explanations of laws and policies that affect your daily life.
          </p>
          <p className="text-sm">
            Follow topics you care about and stay informed about what's happening in Parliament.
          </p>
        </div>

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="btn-primary w-full text-lg py-4"
        >
          Continue
        </button>

        {/* Footer */}
        <p className="text-xs text-gray-500 mt-8">
          Making democracy accessible to everyone
        </p>
      </div>
    </div>
  );
};

export default SplashScreen; 