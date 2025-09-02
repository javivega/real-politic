import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import SplashScreen from './components/SplashScreen';
import SignInScreen from './components/SignInScreen';
import TopicSelectionScreen from './components/TopicSelectionScreen';
import MainLayout from './components/MainLayout';
import FeedScreen from './components/FeedScreen';
import TopicsScreen from './components/TopicsScreen';
import DataScreen from './components/DataScreen';
import CongressInitiativesList from './components/CongressInitiativesList';
import InitiativeDetailScreen from './components/InitiativeDetailScreen';
import AccountScreen from './components/AccountScreen';
import LawDetailScreen from './components/LawDetailScreen';
import TopicDetailScreen from './components/TopicDetailScreen';
import { AppProvider } from './context/AppContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  const handleSignIn = () => {
    setIsAuthenticated(true);
  };

  const handleOnboardingComplete = () => {
    setHasCompletedOnboarding(true);
  };

  return (
    <AppProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Onboarding Flow */}
            <Route 
              path="/" 
              element={
                !isAuthenticated ? (
                  <SplashScreen onContinue={() => setIsAuthenticated(true)} />
                ) : !hasCompletedOnboarding ? (
                  <TopicSelectionScreen onComplete={handleOnboardingComplete} />
                ) : (
                  <Navigate to="/feed" replace />
                )
              } 
            />
            
            <Route 
              path="/signin" 
              element={
                !isAuthenticated ? (
                  <SignInScreen onSignIn={handleSignIn} />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />

            {/* Main App Routes */}
            <Route path="/" element={<MainLayout />}>
              <Route path="/feed" element={<FeedScreen />} />
              <Route path="/topics" element={<TopicsScreen />} />
              <Route path="/data" element={<DataScreen />} />
              <Route path="/congress" element={<CongressInitiativesList />} />
              <Route path="/initiative/:id" element={<InitiativeDetailScreen />} />
              <Route path="/account" element={<AccountScreen />} />
              <Route path="/law/:id" element={<LawDetailScreen />} />
              <Route path="/topic/:id" element={<TopicDetailScreen />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}

export default App; 