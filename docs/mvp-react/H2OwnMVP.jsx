import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Droplets, Thermometer, Sun, AlertTriangle, CheckCircle, TrendingUp, Settings, Beaker, Activity, Cloud } from 'lucide-react';

const H2OwnMVP = () => {
  const [poolProfile, setPoolProfile] = useState({
    volume: 20000,
    surfaceType: 'plaster',
    chlorinationType: 'salt',
    saltLevel: 3200,
    shadeLevel: 'partial',
    enclosure: 'open',
    gpm: 75,
    filterType: 'cartridge'
  });

  const [currentTests, setCurrentTests] = useState({
    fc: 2.8,
    tc: 3.1,
    ph: 7.8,
    ta: 110,
    ch: 180,
    cya: 45,
    salt: 3200,
    temp: 82,
    timestamp: new Date().toISOString()
  });

  const [weather, setWeather] = useState({
    airTemp: 88,
    uvIndex: 8,
    forecast: 'sunny',
    rainfall: 0
  });

  const [usage, setUsage] = useState({
    batherCount: 4,
    duration: 120,
    activityLevel: 'moderate'
  });

  const [recommendations, setRecommendations] = useState([]);
  const [showDebug, setShowDebug] = useState(false);

  // Optimal ranges
  const optimalRanges = {
    fc: { min: 1.0, max: 3.0, target: 2.0 },
    ph: { min: 7.2, max: 7.6, target: 7.4 },
    ta: { min: 80, max: 120, target: 100 },
    ch: { min: 150, max: 300, target: 200 },
    cya: { min: 30, max: 50, target: 40 },
    salt: { min: 2700, max: 3400, target: 3200 }
  };

  // Chemical interaction model
  const calculateRecommendations = () => {
    const recs = [];
    const issues = [];

    // Check each parameter
    Object.entries(currentTests).forEach(([param, value]) => {
      if (optimalRanges[param]) {
        const range = optimalRanges[param];
        if (value < range.min || value > range.max) {
          issues.push({ param, value, range, severity: Math.abs(value - range.target) });
        }
      }
    });

    // Generate recommendations based on issues
    issues.forEach(issue => {
      const rec = generateRecommendation(issue);
      if (rec) recs.push(rec);
    });

    return recs.sort((a, b) => b.priority - a.priority);
  };

  const generateRecommendation = (issue) => {
    const { param, value, range } = issue;
    const poolVol = poolProfile.volume;
    
    switch (param) {
      case 'fc':
        if (value < range.min) {
          const deficit = range.target - value;
          const saltAdjustment = deficit * poolVol * 0.00013; // Simplified salt chlorinator boost
          return {
            id: `fc-low-${Date.now()}`,
            priority: 9,
            type: 'chemical',
            title: 'Low Free Chlorine Detected',
            issue: `FC at ${value} ppm is below optimal range (${range.min}-${range.max} ppm)`,
            recommendation: `Increase salt chlorinator output by ${Math.round(saltAdjustment * 100)}% for 24 hours`,
            alternatives: [
              {
                method: 'Liquid Chlorine',
                amount: `${(deficit * poolVol * 0.00013 * 128).toFixed(1)} fl oz`,
                pros: ['Immediate effect', 'Precise dosing'],
                cons: ['Manual addition required', 'Raises pH slightly']
              },
              {
                method: 'Salt Boost',
                amount: `${Math.round(saltAdjustment * 100)}% increase for 24h`,
                pros: ['Automated', 'Gradual increase', 'No pH impact'],
                cons: ['Slower response', 'Weather dependent']
              }
            ],
            rationale: `With current UV index of ${weather.uvIndex} and ${usage.batherCount} bathers, chlorine demand is elevated. Salt system can handle this gradually.`,
            expectedOutcome: `FC should reach ${range.target} ppm within 12-24 hours`,
            factors: {
              weather: weather.uvIndex > 6 ? 'High UV increases chlorine consumption' : 'Moderate UV impact',
              usage: usage.batherCount > 2 ? 'Multiple bathers increase chlorine demand' : 'Light usage impact',
              temperature: currentTests.temp > 80 ? 'Warm water accelerates chlorine loss' : 'Temperature within normal range'
            }
          };
        }
        break;
      
      case 'ph':
        if (value > range.max) {
          const reduction = value - range.target;
          const acidAmount = reduction * poolVol * 0.00008;
          return {
            id: `ph-high-${Date.now()}`,
            priority: 8,
            type: 'chemical',
            title: 'High pH Detected',
            issue: `pH at ${value} is above optimal range (${range.min}-${range.max})`,
            recommendation: `Add ${(acidAmount * 128).toFixed(1)} fl oz of muriatic acid`,
            alternatives: [
              {
                method: 'Muriatic Acid',
                amount: `${(acidAmount * 128).toFixed(1)} fl oz`,
                pros: ['Fast acting', 'Cost effective', 'Also lowers TA'],
                cons: ['Requires careful handling', 'Can overshoot']
              },
              {
                method: 'Dry Acid (Sodium Bisulfate)',
                amount: `${(acidAmount * 1.5 * 16).toFixed(1)} oz`,
                pros: ['Safer to handle', 'More gradual'],
                cons: ['More expensive', 'Slower acting']
              }
            ],
            rationale: `High pH reduces chlorine effectiveness and can cause scaling on ${poolProfile.surfaceType} surfaces. With TA at ${currentTests.ta}, acid addition will help both parameters.`,
            expectedOutcome: `pH should drop to ${range.target} within 2-4 hours with circulation`,
            factors: {
              surface: poolProfile.surfaceType === 'plaster' ? 'Plaster surfaces more prone to scaling at high pH' : 'Surface type consideration',
              ta: currentTests.ta > 120 ? 'High TA contributing to pH rise' : 'TA within acceptable range',
              temperature: 'Warm water increases chemical reaction speed'
            }
          };
        }
        break;

      case 'cya':
        if (value > range.max) {
          return {
            id: `cya-high-${Date.now()}`,
            priority: 6,
            type: 'maintenance',
            title: 'High Cyanuric Acid (CYA)',
            issue: `CYA at ${value} ppm reduces chlorine effectiveness`,
            recommendation: `Partial water replacement recommended - drain and refill 30% of pool`,
            alternatives: [
              {
                method: 'Partial Drain & Refill',
                amount: '30% water replacement',
                pros: ['Most effective solution', 'Resets other parameters'],
                cons: ['Water waste', 'Time consuming', 'Refill costs']
              },
              {
                method: 'CYA Reducer (if available)',
                amount: 'Follow product instructions',
                pros: ['No water waste', 'Targeted reduction'],
                cons: ['Expensive', 'Not widely available', 'Slower process']
              }
            ],
            rationale: `CYA over 50 ppm significantly reduces chlorine effectiveness. With current FC at ${currentTests.fc} ppm, effective chlorine is much lower than measured.`,
            expectedOutcome: `30% water replacement should reduce CYA to ~${Math.round(value * 0.7)} ppm`,
            factors: {
              effectiveness: 'High CYA masks true sanitizer effectiveness',
              seasonal: poolProfile.shadeLevel === 'full' ? 'Shaded pools can operate with lower CYA' : 'Sun exposure requires adequate CYA',
              cost: 'Consider water and chemical costs vs. effectiveness gains'
            }
          };
        }
        break;
    }
    return null;
  };

  useEffect(() => {
    const recs = calculateRecommendations();
    setRecommendations(recs);
  }, [currentTests, weather, usage, poolProfile]);

  const getStatusColor = (param, value) => {
    const range = optimalRanges[param];
    if (!range) return 'text-gray-600';
    if (value < range.min || value > range.max) return 'text-red-600';
    if (value >= range.min && value <= range.max) return 'text-green-600';
    return 'text-yellow-600';
  };

  const getStatusIcon = (param, value) => {
    const range = optimalRanges[param];
    if (!range) return <Activity className="w-4 h-4" />;
    if (value < range.min || value > range.max) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    return <CheckCircle className="w-4 h-4 text-green-600" />;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-cyan-50 min-h-screen">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-blue-900 mb-2 flex items-center justify-center gap-3">
          <Droplets className="w-10 h-10 text-blue-600" />
          H2Own
        </h1>
        <p className="text-blue-700 text-lg">Smart Pool Chemistry Advisor</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Current Status */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Beaker className="w-5 h-5" />
              Current Pool Chemistry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(currentTests).filter(([key]) => optimalRanges[key]).map(([param, value]) => (
                <div key={param} className="text-center p-3 bg-white rounded-lg border">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {getStatusIcon(param, value)}
                    <span className="text-sm font-medium uppercase">{param}</span>
                  </div>
                  <div className={`text-lg font-bold ${getStatusColor(param, value)}`}>
                    {value} {param === 'ph' ? '' : 'ppm'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Target: {optimalRanges[param].target}{param === 'ph' ? '' : 'ppm'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Environmental Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              Environment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Thermometer className="w-4 h-4" />
                Air Temp
              </span>
              <span className="font-semibold">{weather.airTemp}°F</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Sun className="w-4 h-4" />
                UV Index
              </span>
              <span className="font-semibold">{weather.uvIndex}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Pool Temp</span>
              <span className="font-semibold">{currentTests.temp}°F</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Bathers Today</span>
              <span className="font-semibold">{usage.batherCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Smart Recommendations
          </h2>
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            {showDebug ? 'Hide' : 'Show'} Debug
          </button>
        </div>

        {recommendations.length === 0 ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your pool chemistry looks great! All parameters are within optimal ranges.
            </AlertDescription>
          </Alert>
        ) : (
          recommendations.map((rec, index) => (
            <Card key={rec.id} className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    {rec.title}
                  </span>
                  <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Priority: {rec.priority}/10
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-1">Issue Detected:</h4>
                  <p className="text-red-700">{rec.issue}</p>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-1">Recommended Action:</h4>
                  <p className="text-green-700 font-medium">{rec.recommendation}</p>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Why This Works:</h4>
                  <p className="text-blue-700">{rec.rationale}</p>
                </div>

                <div className="bg-purple-50 p-3 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-1">Expected Outcome:</h4>
                  <p className="text-purple-700">{rec.expectedOutcome}</p>
                </div>

                {/* Alternative Options */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Alternative Options:</h4>
                  <div className="space-y-3">
                    {rec.alternatives?.map((alt, altIndex) => (
                      <div key={altIndex} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium">{alt.method}</h5>
                          <span className="text-sm text-gray-600">{alt.amount}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="font-medium text-green-700">Pros:</span>
                            <ul className="list-disc list-inside text-green-600 ml-2">
                              {alt.pros.map((pro, proIndex) => (
                                <li key={proIndex}>{pro}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-medium text-red-700">Cons:</span>
                            <ul className="list-disc list-inside text-red-600 ml-2">
                              {alt.cons.map((con, conIndex) => (
                                <li key={conIndex}>{con}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Debug Information */}
                {showDebug && (
                  <div className="border-t pt-4 bg-gray-100 p-3 rounded-lg">
                    <h4 className="font-semibold mb-2">Debug Information:</h4>
                    <div className="text-sm space-y-1">
                      {Object.entries(rec.factors || {}).map(([factor, description]) => (
                        <div key={factor}>
                          <span className="font-medium capitalize">{factor}:</span> {description}
                        </div>
                      ))}
                      <div className="mt-2 text-xs text-gray-600">
                        Pool Volume: {poolProfile.volume.toLocaleString()} gal | 
                        Surface: {poolProfile.surfaceType} | 
                        System: {poolProfile.chlorinationType}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Quick Test Input */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Test Update</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(currentTests).filter(([key]) => optimalRanges[key]).map(([param, value]) => (
              <div key={param}>
                <label className="block text-sm font-medium mb-1 uppercase">{param}</label>
                <input
                  type="number"
                  step="0.1"
                  value={value}
                  onChange={(e) => setCurrentTests(prev => ({
                    ...prev,
                    [param]: parseFloat(e.target.value) || 0
                  }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Update test values to get new recommendations. Changes are processed automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default H2OwnMVP;