import React, { useState } from 'react';

interface CostCalculatorProps {
  initiativesCount: number;
  averageVisitsPerInitiative: number;
  costPerAnalysis: number;
}

const CostCalculator: React.FC<CostCalculatorProps> = ({
  initiativesCount,
  averageVisitsPerInitiative,
  costPerAnalysis
}) => {
  const [customInitiatives, setCustomInitiatives] = useState(initiativesCount);
  const [customVisits, setCustomVisits] = useState(averageVisitsPerInitiative);

  const calculateCosts = () => {
    const totalVisits = customInitiatives * customVisits;
    
    // Without caching: every visit costs money
    const costWithoutCaching = totalVisits * costPerAnalysis;
    
    // With caching: only first visit costs money
    const costWithCaching = customInitiatives * costPerAnalysis;
    
    const totalSaved = costWithoutCaching - costWithCaching;
    const percentageSaved = (totalSaved / costWithoutCaching) * 100;
    
    return {
      withoutCaching: costWithoutCaching,
      withCaching: costWithCaching,
      totalSaved,
      percentageSaved
    };
  };

  const costs = calculateCosts();

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Calculadora de Ahorro de Costos</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Input Controls */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de Iniciativas
            </label>
            <input
              type="number"
              value={customInitiatives}
              onChange={(e) => setCustomInitiatives(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="10000"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visitas Promedio por Iniciativa
            </label>
            <input
              type="number"
              value={customVisits}
              onChange={(e) => setCustomVisits(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="100"
            />
          </div>
          
          <div className="text-sm text-gray-600">
            <p>• <strong>Sin caché:</strong> $0.002 por iniciativa (3 análisis: problema, investigación externa, pros/contra técnicos)</p>
            <p>• <strong>Con caché:</strong> $0.002 solo en la primera visita, luego gratis</p>
            <p>• <strong>Análisis incluidos:</strong> Problema, Investigación externa, Pros/contra técnicos</p>
          </div>
        </div>
        
        {/* Results */}
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h4 className="font-semibold text-red-800 mb-2">❌ Sin Cache</h4>
            <div className="text-red-700">
              <p><strong>Total de visitas:</strong> {customInitiatives * customVisits}</p>
              <p><strong>Costo total:</strong> ${costs.withoutCaching.toFixed(3)}</p>
              <p><strong>Con $10 podrías:</strong> {Math.floor(10 / costs.withoutCaching)} iniciativas</p>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2">✅ Con Cache</h4>
            <div className="text-green-700">
              <p><strong>Total de visitas:</strong> {customInitiatives * customVisits}</p>
              <p><strong>Costo total:</strong> ${costs.withCaching.toFixed(3)}</p>
              <p><strong>Con $10 podrías:</strong> {Math.floor(10 / costs.withCaching)} iniciativas</p>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2">🎯 Ahorro Total</h4>
            <div className="text-blue-700">
              <p><strong>Dinero ahorrado:</strong> ${costs.totalSaved.toFixed(3)}</p>
              <p><strong>Porcentaje ahorrado:</strong> {costs.percentageSaved.toFixed(1)}%</p>
              <p><strong>Iniciativas extra:</strong> {Math.floor(costs.totalSaved / costPerAnalysis)}</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Real-world examples */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-3">🌍 Ejemplos del Mundo Real</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold text-lg text-blue-600">100</div>
            <div className="text-gray-600">Iniciativas</div>
            <div className="text-gray-600">5 visitas cada una</div>
            <div className="font-semibold text-green-600">Ahorro: $0.40</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-blue-600">500</div>
            <div className="text-gray-600">Iniciativas</div>
            <div className="text-gray-600">3 visitas cada una</div>
            <div className="font-semibold text-green-600">Ahorro: $1.00</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-lg text-blue-600">1000</div>
            <div className="text-gray-600">Iniciativas</div>
            <div className="text-gray-600">2 visitas cada una</div>
            <div className="font-semibold text-green-600">Ahorro: $1.00</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostCalculator; 