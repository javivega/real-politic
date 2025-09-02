import React, { useState, useEffect } from 'react';
import { CongressService } from '../services/congressService';
import { CongressInitiative, PoliticalParty } from '../lib/supabase';

const DataScreen: React.FC = () => {
  const [dateRange, setDateRange] = useState('30d');
  const [politicalGroup, setPoliticalGroup] = useState('all');
  const [topic, setTopic] = useState('all');
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>({
    totalInitiatives: 0,
    typeStats: {},
    partyStats: [],
    recentInitiatives: []
  });
  const [initiatives, setInitiatives] = useState<CongressInitiative[]>([]);
  const [politicalParties, setPoliticalParties] = useState<PoliticalParty[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stats, allInitiatives, parties] = await Promise.all([
        CongressService.getStatistics(),
        CongressService.getInitiatives(),
        CongressService.getPoliticalParties()
      ]);
      
      setStatistics(stats);
      setInitiatives(allInitiatives);
      setPoliticalParties(parties);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInitiatives = initiatives.filter(initiative => {
    if (politicalGroup !== 'all' && initiative.political_party_short_name !== politicalGroup) {
      return false;
    }
    // Add more filtering logic here if needed
    return true;
  });

  const getPartyColor = (partyShortName: string) => {
    const party = politicalParties.find(p => p.short_name === partyShortName);
    return party?.color || '#666666';
  };

  const getPartyName = (partyShortName: string) => {
    const party = politicalParties.find(p => p.short_name === partyShortName);
    return party?.name || partyShortName;
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading Congress data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Congress Data & Insights</h1>
        <p className="text-gray-600">
          Real-time data from the Spanish Congress of Deputies
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="flex-1 input-field text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          
          <select
            value={politicalGroup}
            onChange={(e) => setPoliticalGroup(e.target.value)}
            className="flex-1 input-field text-sm"
          >
            <option value="all">All Parties</option>
            {politicalParties.map((party) => (
              <option key={party.short_name} value={party.short_name}>
                {party.short_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card text-center">
          <div className="text-2xl font-bold text-primary-600 mb-1">
            {statistics.totalInitiatives}
          </div>
          <div className="text-sm text-gray-600">Total Initiatives</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {statistics.partyStats.length}
          </div>
          <div className="text-sm text-gray-600">Active Parties</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {Object.keys(statistics.typeStats).length}
          </div>
          <div className="text-sm text-gray-600">Initiative Types</div>
        </div>
        
        <div className="card text-center">
          <div className="text-2xl font-bold text-orange-600 mb-1">
            {initiatives.filter(i => i.tipo_tramitacion === 'urgente').length}
          </div>
          <div className="text-sm text-gray-600">Iniciativas Urgentes</div>
        </div>
      </div>

      {/* Political Parties Chart */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Initiatives by Political Party</h3>
        <div className="space-y-3">
          {statistics.partyStats
            .sort((a: any, b: any) => b.count - a.count)
            .slice(0, 10)
            .map((party: any) => (
            <div key={party.short_name} className="flex items-center">
              <div className="w-32 text-sm text-gray-600 truncate">{party.name}</div>
              <div className="flex-1 mx-3">
                <div className="bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full"
                    style={{ 
                      width: `${(party.count / statistics.totalInitiatives) * 100}%`,
                      backgroundColor: party.color
                    }}
                  ></div>
                </div>
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 text-right">
                {party.count}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Initiative Types Distribution */}
      <div className="card mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Distribution by Initiative Type</h3>
        <div className="space-y-3">
          {Object.entries(statistics.typeStats)
            .sort(([,a]: any, [,b]: any) => b - a)
            .slice(0, 8)
            .map(([type, count]: [string, any]) => (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                <span className="text-sm text-gray-700 truncate">{type}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">{count}</span>
                <span className="text-xs text-gray-500">
                  ({Math.round((count / statistics.totalInitiatives) * 100)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Initiatives */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Iniciativas Recientes</h3>
        {statistics.recentInitiatives.map((initiative: CongressInitiative, index: number) => (
          <div key={index} className="card cursor-pointer hover:shadow-md transition-shadow duration-200">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-gray-900 text-sm leading-tight flex-1 pr-4">
                {initiative.accessible_title || initiative.objeto}
              </h4>
              <span 
                className="px-2 py-1 text-xs rounded-full text-white flex-shrink-0"
                style={{ backgroundColor: getPartyColor(initiative.political_party_short_name) }}
              >
                {getPartyName(initiative.political_party_short_name)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{initiative.congress_initiative_type?.replace(/_/g, ' ')}</span>
              <span>{new Date(initiative.fecha_presentacion).toLocaleDateString('es-ES')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Data Source Info */}
      <div className="mt-6 text-center text-xs text-gray-500">
        Data source: Spanish Congress of Deputies • Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default DataScreen; 