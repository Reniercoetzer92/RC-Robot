import { useState, useEffect, useCallback, useMemo } from 'react';
import "./components_css/TradingRobot.css";
import BinanceAPIDialog from './BinanceAPIDialog.jsx';
import PropTypes from 'prop-types';

// Create a reusable Option component
const Option = ({ label, value, options, onChange }) => (
  <div>
    <label>
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  </div>
);

const getChangeSymbol = (change) => {
  return change > 0 ? '+' : (change < 0 ? '-' : '');
};


// Define the TradingRobot component
const TradingRobot = () => {
  // Define state variables for options and settings
  const [strategy, setStrategy] = useState('MA_Crossover');
  const [riskLevel, setRiskLevel] = useState(1);
  const [targetProfit, setTargetProfit] = useState(5);
  const [klineInterval, setKlineInterval] = useState('1h');
  const [token, setToken] = useState('BNB');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Define state variable for market data
  const [marketData, setMarketData] = useState([
    { symbol: 'BNB', price: 0, change: 0 },
    { symbol: 'ETH', price: 0, change: 0 },
    { symbol: 'BTC', price: 0, change: 0 },
  ]);

  // Define state variables for profit/loss
  const [initialBalance] = useState(10000);
  const [currentBalance, setCurrentBalance] = useState(initialBalance);
  const [profitLoss, setProfitLoss] = useState(0);

  // Define strategy options
  const strategyOptions = ['MA_Crossover', 'RSI_Overbought', 'CustomStrategy'];

  // Define kline interval options
  const klineIntervalOptions = ['1m', '5m', '15m', '30m', '1h', ];

  // Define token options
  const tokenOptions = useMemo(() => ['BNB', 'ETH', 'BTC'], []);

  // Define a function to handle form submission
  const handleFormSubmit = (e) => {
    e.preventDefault();

    // Fetch market data for the selected tokens
    fetchMarketData();

    // TODO: Add logic to handle the form submission, such as sending data to the trading robot

    // For now, just log the selected options and settings
    console.log('Selected Token:', token);
    console.log('Kline Interval:', klineInterval);
    console.log('Selected Strategy:', strategy);
    console.log('Risk Level:', riskLevel);
    console.log('Target Profit:', targetProfit);

    // Update profit/loss based on some hypothetical logic (replace with actual implementation)
    const simulatedProfitLoss = Math.random() * 1000 - 500; // Simulating profit/loss
    setProfitLoss(simulatedProfitLoss);

    // Update current balance
    setCurrentBalance(initialBalance + simulatedProfitLoss);
  };

  // Define a function to fetch market data for the selected tokens
  const fetchMarketData = useCallback(async () => {
    const updatedMarketData = await Promise.all(tokenOptions.map(async (token) => {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${token}USDT`);
      const data = await response.json();
      const price = parseFloat(data.lastPrice);
      const change = parseFloat(data.priceChangePercent).toFixed(2); // Round to 2 decimals
      return {
        symbol: token,
        price,
        change,
      };
    }));

    setMarketData(updatedMarketData);
  }, [tokenOptions]); // Include tokenOptions in the dependency array

  // Fetch initial market data on component mount
  useEffect(() => {
    fetchMarketData();

    // Set up interval to fetch market data every 5 seconds
    const intervalId = setInterval(fetchMarketData, 5000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchMarketData]); // Include fetchMarketData in the dependency array

  // Render the component
  return (
    <div>
      <h1 className="market-data-heading">
        Market Data
        <div className="settings-button-container">
          <button
            className="settings-button"
            onClick={() => setIsDialogOpen(true)}
            aria-label="Open Settings"
          >
            ⚙️
          </button>
        </div>
      </h1>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change (24h %)</th>
          </tr>
        </thead>
        <tbody>
          {/* Inside the tbody */}
          {marketData.map((data) => (
            <tr key={data.symbol}>
              <td>{data.symbol}</td>
              <td>{data.price}</td>
              <td>{`${getChangeSymbol(data.change)}${data.change}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h1>Trading Robot Settings</h1>
      <form onSubmit={handleFormSubmit}>
        {/* Use the Option component for each setting */}
        <Option label="Select Token" value={token} options={tokenOptions} onChange={setToken} />
        <div className="custom-strategy-container">
          <Option label="Select Trading Strategy" value={strategy} options={strategyOptions} onChange={setStrategy} />
          {strategy === 'CustomStrategy' && (
            <button type="button">
              Edit
            </button>
          )}
        </div>
        <Option label="Risk Level" value={riskLevel} options={[1, 2, 3, 4, 5]} onChange={setRiskLevel} />
        <Option label="Target Profit (%)" value={targetProfit} options={[5, 10, 15, 20]} onChange={setTargetProfit} />
        <Option label="Kline Interval" value={klineInterval} options={klineIntervalOptions} onChange={setKlineInterval} />

        <button type="submit">Start Trading</button>
      </form>

      {/* Display Profit/Loss section */}
      <h2>Profit/Loss</h2>
      <p>Initial Balance: ${initialBalance}</p>
      <p>Current Balance: ${currentBalance}</p>
      <p>Profit/Loss: ${profitLoss}</p>
      {/* Binance API Dialog */}
      <BinanceAPIDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
};

// Add propTypes validation for the Option component
Option.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default TradingRobot;
