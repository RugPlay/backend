export default {
  // Fixed deterioration amount per corporation per interval
  deteriorationAmount: parseFloat(process.env.INFLUENCE_DETERIORATION_AMOUNT || '1.0'),
  
  // Deterioration interval in seconds (e.g., 3600 = 1 hour)
  deteriorationIntervalSeconds: parseInt(process.env.INFLUENCE_DETERIORATION_INTERVAL || '3600', 10),
  
  // USD cost per unit of influence
  usdCostPerInfluence: parseFloat(process.env.INFLUENCE_USD_COST || '100.0'),
  
  // Minimum influence that can be purchased
  minPurchaseAmount: parseFloat(process.env.INFLUENCE_MIN_PURCHASE || '1.0'),
};

