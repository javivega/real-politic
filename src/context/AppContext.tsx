import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Topic {
  id: string;
  name: string;
  icon: string;
  description: string;
  isSelected: boolean;
  isFollowed: boolean;
}

export interface Law {
  id: string;
  title: string;
  description: string;
  stage: 'proposed' | 'debating' | 'voting' | 'passed' | 'rejected';
  type: 'bill' | 'amendment' | 'resolution';
  proposer: string;
  date: string;
  topics: string[];
  problem: string;
  pros: string[];
  cons: string[];
  support: string[];
  opposition: string[];
  timeline: Array<{
    date: string;
    event: string;
    status: string;
  }>;
  officialSource: string;
  isFollowed: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  selectedTopics: string[];
  followedLaws: string[];
  notificationSettings: {
    email: boolean;
    push: boolean;
    topicUpdates: boolean;
    lawUpdates: boolean;
  };
}

interface AppContextType {
  user: User | null;
  topics: Topic[];
  laws: Law[];
  selectedTopics: string[];
  followedLaws: string[];
  updateSelectedTopics: (topicIds: string[]) => void;
  toggleTopicFollow: (topicId: string) => void;
  toggleLawFollow: (lawId: string) => void;
  updateUser: (user: User) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [followedLaws, setFollowedLaws] = useState<string[]>([]);

  // Mock data for topics
  const [topics] = useState<Topic[]>([
    {
      id: 'education',
      name: 'Education',
      icon: '🎓',
      description: 'School policies, curriculum changes, student rights',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'health',
      name: 'Healthcare',
      icon: '🏥',
      description: 'Medical services, public health, insurance',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'economy',
      name: 'Economy',
      icon: '💰',
      description: 'Taxes, business regulations, economic policies',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'environment',
      name: 'Environment',
      icon: '🌱',
      description: 'Climate change, pollution, conservation',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'justice',
      name: 'Justice',
      icon: '⚖️',
      description: 'Legal system, civil rights, criminal law',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'transport',
      name: 'Transport',
      icon: '🚗',
      description: 'Roads, public transit, infrastructure',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'housing',
      name: 'Housing',
      icon: '🏠',
      description: 'Affordable housing, zoning, property rights',
      isSelected: false,
      isFollowed: false,
    },
    {
      id: 'technology',
      name: 'Technology',
      icon: '💻',
      description: 'Digital services, internet regulation, innovation',
      isSelected: false,
      isFollowed: false,
    },
  ]);

  // Mock data for laws
  const [laws] = useState<Law[]>([
    {
      id: 'law-001',
      title: 'Digital Education Access Act',
      description: 'Ensures all students have access to digital learning tools and internet connectivity',
      stage: 'debating',
      type: 'bill',
      proposer: 'Progressive Party',
      date: '2024-01-15',
      topics: ['education', 'technology'],
      problem: 'Many students lack access to digital learning tools, creating educational inequality',
      pros: [
        'Reduces educational inequality',
        'Prepares students for digital future',
        'Improves learning outcomes'
      ],
      cons: [
        'High implementation costs',
        'Requires ongoing maintenance',
        'May widen digital divide initially'
      ],
      support: ['Progressive Party', 'Green Alliance'],
      opposition: ['Conservative Union', 'Business First'],
      timeline: [
        { date: '2024-01-15', event: 'Introduced to Parliament', status: 'proposed' },
        { date: '2024-02-01', event: 'First reading completed', status: 'debating' },
        { date: '2024-02-15', event: 'Committee review', status: 'debating' }
      ],
      officialSource: 'https://parliament.gov/law-001',
      isFollowed: false,
    },
    {
      id: 'law-002',
      title: 'Clean Energy Transition Bill',
      description: 'Accelerates the transition to renewable energy sources with support for workers',
      stage: 'voting',
      type: 'bill',
      proposer: 'Green Alliance',
      date: '2024-01-10',
      topics: ['environment', 'economy'],
      problem: 'Climate change requires urgent action, but workers need support during transition',
      pros: [
        'Addresses climate crisis',
        'Creates new green jobs',
        'Reduces energy costs long-term'
      ],
      cons: [
        'High upfront investment',
        'Job displacement in fossil fuel sector',
        'Energy price volatility during transition'
      ],
      support: ['Green Alliance', 'Progressive Party'],
      opposition: ['Conservative Union', 'Business First'],
      timeline: [
        { date: '2024-01-10', event: 'Introduced to Parliament', status: 'proposed' },
        { date: '2024-01-25', event: 'Debate completed', status: 'voting' },
        { date: '2024-02-01', event: 'Vote scheduled', status: 'voting' }
      ],
      officialSource: 'https://parliament.gov/law-002',
      isFollowed: false,
    },
    {
      id: 'law-003',
      title: 'Healthcare Accessibility Amendment',
      description: 'Expands healthcare coverage to include mental health services and preventive care',
      stage: 'passed',
      type: 'amendment',
      proposer: 'Progressive Party',
      date: '2023-12-20',
      topics: ['health'],
      problem: 'Mental health services are not adequately covered, leading to untreated conditions',
      pros: [
        'Improves public health outcomes',
        'Reduces long-term healthcare costs',
        'Addresses mental health crisis'
      ],
      cons: [
        'Increases healthcare spending',
        'May strain healthcare system',
        'Requires additional healthcare workers'
      ],
      support: ['Progressive Party', 'Green Alliance'],
      opposition: ['Conservative Union'],
      timeline: [
        { date: '2023-12-20', event: 'Introduced to Parliament', status: 'proposed' },
        { date: '2024-01-05', event: 'Debate completed', status: 'voting' },
        { date: '2024-01-10', event: 'Vote passed', status: 'passed' }
      ],
      officialSource: 'https://parliament.gov/law-003',
      isFollowed: false,
    },
  ]);

  const updateSelectedTopics = (topicIds: string[]) => {
    setSelectedTopics(topicIds);
    // Update topics selection state
    topics.forEach(topic => {
      topic.isSelected = topicIds.includes(topic.id);
    });
  };

  const toggleTopicFollow = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (topic) {
      topic.isFollowed = !topic.isFollowed;
    }
  };

  const toggleLawFollow = (lawId: string) => {
    const law = laws.find(l => l.id === lawId);
    if (law) {
      law.isFollowed = !law.isFollowed;
      if (law.isFollowed) {
        setFollowedLaws(prev => [...prev, lawId]);
      } else {
        setFollowedLaws(prev => prev.filter(id => id !== lawId));
      }
    }
  };

  const updateUser = (newUser: User) => {
    setUser(newUser);
  };

  const value: AppContextType = {
    user,
    topics,
    laws,
    selectedTopics,
    followedLaws,
    updateSelectedTopics,
    toggleTopicFollow,
    toggleLawFollow,
    updateUser,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}; 