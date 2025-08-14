import { supabase } from '../lib/supabase';

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');

  try {
    // Seed political parties
    console.log('📊 Seeding political parties...');
    const parties = [
      {
        name: 'Progressive Party',
        short_name: 'PP',
        logo: '🏛️',
        color: '#3B82F6',
        ideology: 'Progressive, Social Democracy',
        leader: 'Sarah Johnson',
        seats: 45,
      },
      {
        name: 'Conservative Union',
        short_name: 'CU',
        logo: '⚖️',
        color: '#EF4444',
        ideology: 'Conservative, Free Market',
        leader: 'Michael Chen',
        seats: 38,
      },
      {
        name: 'Green Alliance',
        short_name: 'GA',
        logo: '🌱',
        color: '#10B981',
        ideology: 'Environmental, Social Justice',
        leader: 'Emma Rodriguez',
        seats: 22,
      },
      {
        name: 'Business First',
        short_name: 'BF',
        logo: '💼',
        color: '#8B5CF6',
        ideology: 'Pro-Business, Centrist',
        leader: 'David Thompson',
        seats: 15,
      },
    ];

    for (const party of parties) {
      const { error } = await supabase
        .from('political_parties')
        .upsert(party, { onConflict: 'short_name' });
      
      if (error) {
        console.error(`Error seeding party ${party.short_name}:`, error);
      }
    }

    // Seed topics
    console.log('🏷️ Seeding topics...');
    const topics = [
      {
        name: 'Education',
        slug: 'education',
        icon: '🎓',
        description: 'School policies, curriculum changes, student rights, and educational reforms',
        category: 'Social',
      },
      {
        name: 'Healthcare',
        slug: 'healthcare',
        icon: '🏥',
        description: 'Medical services, public health, insurance, and healthcare accessibility',
        category: 'Social',
      },
      {
        name: 'Economy',
        slug: 'economy',
        icon: '💰',
        description: 'Taxes, business regulations, economic policies, and financial reforms',
        category: 'Economic',
      },
      {
        name: 'Environment',
        slug: 'environment',
        icon: '🌱',
        description: 'Climate change, pollution, conservation, and environmental protection',
        category: 'Environmental',
      },
      {
        name: 'Justice',
        slug: 'justice',
        icon: '⚖️',
        description: 'Legal system, civil rights, criminal law, and judicial reforms',
        category: 'Legal',
      },
      {
        name: 'Transport',
        slug: 'transport',
        icon: '🚗',
        description: 'Roads, public transit, infrastructure, and transportation policies',
        category: 'Infrastructure',
      },
      {
        name: 'Housing',
        slug: 'housing',
        icon: '🏠',
        description: 'Affordable housing, zoning, property rights, and urban development',
        category: 'Social',
      },
      {
        name: 'Technology',
        slug: 'technology',
        icon: '💻',
        description: 'Digital services, internet regulation, innovation, and tech policies',
        category: 'Technology',
      },
    ];

    for (const topic of topics) {
      const { error } = await supabase
        .from('topics')
        .upsert(topic, { onConflict: 'slug' });
      
      if (error) {
        console.error(`Error seeding topic ${topic.slug}:`, error);
      }
    }

    // Seed sample laws
    console.log('📜 Seeding sample laws...');
    const laws = [
      {
        title: 'Digital Education Access Act',
        slug: 'digital-education-access-act',
        description: 'Ensures all students have access to digital learning tools and internet connectivity',
        summary: 'A comprehensive bill to bridge the digital divide in education',
        stage: 'debating',
        type: 'bill',
        proposer: 'Sarah Johnson',
        proposer_party: 'PP',
        introduction_date: '2024-01-15',
      },
      {
        title: 'Clean Energy Transition Bill',
        slug: 'clean-energy-transition-bill',
        description: 'Accelerates the transition to renewable energy sources with support for workers',
        summary: 'Comprehensive energy policy to combat climate change',
        stage: 'voting',
        type: 'bill',
        proposer: 'Emma Rodriguez',
        proposer_party: 'GA',
        introduction_date: '2024-01-10',
      },
      {
        title: 'Healthcare Accessibility Amendment',
        slug: 'healthcare-accessibility-amendment',
        description: 'Expands healthcare coverage to include mental health services and preventive care',
        summary: 'Amendment to improve healthcare access and coverage',
        stage: 'passed',
        type: 'amendment',
        proposer: 'Sarah Johnson',
        proposer_party: 'PP',
        introduction_date: '2023-12-20',
      },
      {
        title: 'Small Business Tax Relief Act',
        slug: 'small-business-tax-relief-act',
        description: 'Provides tax relief and incentives for small businesses and startups',
        summary: 'Tax policy to support small business growth',
        stage: 'proposed',
        type: 'bill',
        proposer: 'David Thompson',
        proposer_party: 'BF',
        introduction_date: '2024-02-01',
      },
      {
        title: 'Public Transportation Modernization',
        slug: 'public-transportation-modernization',
        description: 'Modernizes public transportation infrastructure and expands coverage',
        summary: 'Infrastructure bill for transportation improvements',
        stage: 'debating',
        type: 'bill',
        proposer: 'Michael Chen',
        proposer_party: 'CU',
        introduction_date: '2024-01-25',
      },
    ];

    for (const law of laws) {
      const { data: lawData, error: lawError } = await supabase
        .from('laws')
        .upsert(law, { onConflict: 'slug' })
        .select()
        .single();
      
      if (lawError) {
        console.error(`Error seeding law ${law.slug}:`, lawError);
        continue;
      }

      // Add law details
      const lawDetails = {
        law_id: lawData.id,
        problem: 'Many citizens lack access to essential services and opportunities due to outdated infrastructure and policies',
        pros: [
          'Improves public access to services',
          'Creates jobs and economic growth',
          'Addresses social inequalities',
          'Modernizes outdated systems',
        ],
        cons: [
          'High implementation costs',
          'Requires ongoing maintenance',
          'May face political opposition',
          'Implementation timeline challenges',
        ],
        impact: 'Significant positive impact on public welfare and economic development',
        cost: 'Estimated $2.5 billion over 5 years',
        official_source: 'https://parliament.gov/bills/' + law.slug,
      };

      await supabase
        .from('law_details')
        .upsert(lawDetails, { onConflict: 'law_id' });

      // Add law topics (randomly assign 2-3 topics)
      const topicIds = await supabase
        .from('topics')
        .select('id')
        .limit(3);
      
      if (topicIds.data) {
        for (const topic of topicIds.data) {
          await supabase
            .from('law_topics')
            .upsert({
              law_id: lawData.id,
              topic_id: topic.id,
              relevance: Math.floor(Math.random() * 40) + 60, // 60-100
            }, { onConflict: 'law_id,topic_id' });
        }
      }

      // Add law timeline
      const timeline = [
        {
          law_id: lawData.id,
          event: 'Introduced to Parliament',
          date: law.introduction_date,
          status: 'proposed',
        },
        {
          law_id: lawData.id,
          event: 'First reading completed',
          date: new Date(new Date(law.introduction_date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          status: 'debating',
        },
      ];

      for (const event of timeline) {
        await supabase
          .from('law_timelines')
          .insert(event);
      }

      // Add party positions
      const partyPositions = [
        {
          law_id: lawData.id,
          party_name: 'PP',
          position: 'support',
          votes: Math.floor(Math.random() * 20) + 30,
        },
        {
          law_id: lawData.id,
          party_name: 'GA',
          position: 'support',
          votes: Math.floor(Math.random() * 15) + 15,
        },
        {
          law_id: lawData.id,
          party_name: 'CU',
          position: 'oppose',
          votes: Math.floor(Math.random() * 20) + 25,
        },
        {
          law_id: lawData.id,
          party_name: 'BF',
          position: 'neutral',
          votes: Math.floor(Math.random() * 10) + 10,
        },
      ];

      for (const position of partyPositions) {
        await supabase
          .from('law_parties')
          .insert(position);
      }
    }

    console.log('✅ Database seeding completed successfully!');
    
    // Display summary
    const { count: topicsCount } = await supabase
      .from('topics')
      .select('*', { count: 'exact', head: true });
    
    const { count: lawsCount } = await supabase
      .from('laws')
      .select('*', { count: 'exact', head: true });
    
    const { count: partiesCount } = await supabase
      .from('political_parties')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Seeded ${topicsCount} topics, ${lawsCount} laws, and ${partiesCount} political parties`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding process completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding process failed:', error);
      process.exit(1);
    });
}

export default seedDatabase; 