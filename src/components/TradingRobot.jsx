import { useState, useEffect, useCallback, useMemo } from 'react';
import './components_css/TradingRobot.css';
import BinanceAPIDialog from './BinanceAPIDialog.jsx';
import PropTypes from 'prop-types';

const Option = ({ label, value, options, onChange, disabled, riskMessage }) => (
  <div>
    <label>
      {label}:
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {riskMessage && (
        <div className="risk-message">
          {riskMessage}
        </div>
      )}
    </label>
  </div>
);

const TradingRobot = () => {
  const [strategy, setStrategy] = useState('Normal');
  const [riskLevel, setRiskLevel] = useState(1);
  const [targetProfit, setTargetProfit] = useState(5);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInPosition, setIsInPosition] = useState(false);

  const [initialTradingAmount, setInitialTradingAmount] = useState(0);
  const [liveProfitLoss, setLiveProfitLoss] = useState(0);

  const [tokenInfo, setTokenInfo] = useState({
    symbol: '',
    price: 0,
    change: 0,
  });

  const [selectedToken, setSelectedToken] = useState('');
  const [selectedKlineInterval, setSelectedKlineInterval] = useState('24h');
  const [tokenErrorMessage, setTokenErrorMessage] = useState('');

  const [marketData, setMarketData] = useState([
    { symbol: 'BNB', price: 0, change: 0 },
    { symbol: 'ETH', price: 0, change: 0 },
    { symbol: 'BTC', price: 0, change: 0 },
  ]);

  const [initialBalance] = useState(10000);
  const [currentBalance, setCurrentBalance] = useState(initialBalance);
  const [, setProfitLoss] = useState(0);
  const [isTrading, setIsTrading] = useState(false);

  

  const strategyOptions = [
    'Normal_Trading',
    'MA_Crossover',
    'RSI_Overbought',
    'Breakout',
    'Bollinger_Bands',
    'MACD_Divergence',
    'Support_Resistance',
  ];

  const klineIntervalOptions = ['24h', '1m', '5m', '15m', '30m', '1h'];

  const tokenOptions = useMemo(() => ['BNB', 'ETH', 'BTC'], []);

  const fetchTokenInfo = useCallback(
    async (selectedToken, selectedKlineInterval) => {
      if (!selectedToken) {
        setTokenErrorMessage('Please select a token.');
        return;
      }

      const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${selectedToken}USDT`);
      const data = await response.json();
      const price = parseFloat(data.lastPrice);
      let change = parseFloat(data.priceChangePercent).toFixed(2);

      if (selectedKlineInterval !== '24h') {
        const klineResponse = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=${selectedToken}USDT&interval=${selectedKlineInterval}`
        );
        const klineData = await klineResponse.json();
        const changeIndex = klineData.length - 1;
        const openPrice = parseFloat(klineData[changeIndex][1]);
        const closePrice = parseFloat(klineData[changeIndex][4]);
        change = (((closePrice - openPrice) / openPrice) * 100).toFixed(2);
      }

      setTokenInfo({
        symbol: selectedToken,
        price,
        change,
      });
      setTokenErrorMessage('');
    },
    [setTokenInfo]
  );

  const handleTokenChange = (selectedToken) => {
    setSelectedToken(selectedToken);
    fetchTokenInfo(selectedToken, selectedKlineInterval);
  };

  const handleKlineIntervalChange = (selectedKlineInterval) => {
    setSelectedKlineInterval(selectedKlineInterval);
    fetchTokenInfo(selectedToken, selectedKlineInterval);
  };

  const calculateRiskMessage = () => {
    // Calculate risk percentage based on the selected risk level
    const riskPercentage = riskLevel * 20;
    return <p style={{ color: 'red' }}>You will use {riskPercentage}% of your current balance.</p>;
  };

  const fetchMarketData = useCallback(async () => {
    try {
      const updatedMarketData = await Promise.all(
        tokenOptions.map(async (token) => {
          const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${token}USDT`);
          const data = await response.json();
          const price = parseFloat(data.lastPrice);
          const change = parseFloat(data.priceChangePercent).toFixed(2);
          return {
            symbol: token,
            price,
            change,
          };
        })
      );

      setMarketData(updatedMarketData);
    } catch (error) {
      console.error('Error fetching market data:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOptions, setMarketData, selectedToken, selectedKlineInterval])

  useEffect(() => {
    // Fetch initial market data
    fetchMarketData();

    const storedIsInPosition = localStorage.getItem('isInPosition');
    if (storedIsInPosition === 'true') {
      setIsInPosition(true);
    }

    // Set up a timer to fetch data periodically
    const intervalId = setInterval(fetchMarketData, 5000);

    // Clean up the interval when the component is unmounted
    return () => clearInterval(intervalId);
  }, [fetchMarketData, selectedToken, selectedKlineInterval]);

  useEffect(() => {
    // Retrieve values from localStorage or use default values
    const storedSelectedToken = localStorage.getItem('selectedToken') || '';
    const storedSelectedKlineInterval = localStorage.getItem('selectedKlineInterval') || '24h';
    const storedStrategy = localStorage.getItem('strategy') || 'Normal';
    const storedRiskLevel = parseInt(localStorage.getItem('riskLevel'), 10) || 1;
    const storedTargetProfit = parseInt(localStorage.getItem('targetProfit'), 10) || 5;
    const storedInitialBalance = parseFloat(localStorage.getItem('initialBalance')) || 10000;
    const storedIsInPosition = localStorage.getItem('isInPosition') === 'true';

    // Initialize state with retrieved or default values
    setSelectedToken(storedSelectedToken);
    setSelectedKlineInterval(storedSelectedKlineInterval);
    setStrategy(storedStrategy);
    setRiskLevel(storedRiskLevel);
    setTargetProfit(storedTargetProfit);
    setCurrentBalance(storedInitialBalance);
    setIsInPosition(storedIsInPosition);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  // Update localStorage whenever the corresponding state changes
  useEffect(() => {
    localStorage.setItem('selectedToken', selectedToken);
    localStorage.setItem('selectedKlineInterval', selectedKlineInterval);
    localStorage.setItem('strategy', strategy);
    localStorage.setItem('riskLevel', riskLevel);
    localStorage.setItem('targetProfit', targetProfit);
    localStorage.setItem('initialBalance', initialBalance);
    localStorage.setItem('isInPosition', isInPosition.toString());
    localStorage.setItem('initialTradingAmount', initialTradingAmount);
    localStorage.setItem('liveProfitLoss', liveProfitLoss);
    localStorage.setItem('initialTradingAmount', initialTradingAmount);
  }, [selectedToken, selectedKlineInterval, strategy, riskLevel, targetProfit, initialBalance, isInPosition, initialTradingAmount, liveProfitLoss]);

  const startTrading = () => {
    // If already trading or in position, do nothing
    if (isTrading || isInPosition || !selectedToken || !selectedKlineInterval) return;

    // Calculate risk percentage based on the selected risk level
    const riskPercentage = riskLevel * 20;

    // Calculate the amount to use for trading based on the risk percentage
    const tradeAmount = (currentBalance * riskPercentage) / 100;

    // If the calculated trade amount is 0 or negative, do nothing
    if (tradeAmount <= 0) return;

    // Find the market data for the selected token
    const selectedTokenData = marketData.find((data) => data.symbol === selectedToken);

    // If data for the selected token is not available, do nothing
    if (!selectedTokenData) return;

    // Extract the percentage change from the data
    const percentageChange = parseFloat(selectedTokenData.change);

    // Calculate the new amount and profit/loss based on the percentage change
    const newAmount = currentBalance - tradeAmount;
    const newProfitLoss = tradeAmount * (1 + percentageChange / 100);

    // Update state with the new amount and profit/loss
    setCurrentBalance(parseFloat(newAmount.toFixed(2)));
    setInitialTradingAmount(parseFloat(tradeAmount.toFixed(2)));
    setProfitLoss(parseFloat(newProfitLoss.toFixed(2)));
    setIsInPosition(true);
    setIsTrading(true);

    // Save trading state to localStorage
    localStorage.setItem('isInPosition', 'true');
    localStorage.setItem('isTrading', 'true');
    localStorage.setItem('initialTradingAmount', parseFloat(tradeAmount.toFixed(2)));
  };

  const stopTrading = () => {
    // If not in position, do nothing
    if (!isInPosition) return;

    // Find the market data for the selected token
    const selectedTokenData = marketData.find((data) => data.symbol === selectedToken);

    // If data for the selected token is not available, do nothing
    if (!selectedTokenData) return;

    // Extract the percentage change from the data
    const percentageChange = parseFloat(selectedTokenData.change);

    // Calculate the new amount and profit/loss based on the percentage change
    const newAmount = currentBalance + (initialTradingAmount * (1 + percentageChange / 100));
    const newProfitLoss = newAmount - initialBalance;

    // Update state with the new amount and profit/loss
    setCurrentBalance(parseFloat(newAmount.toFixed(2)));
    setProfitLoss(parseFloat(newProfitLoss.toFixed(2)));
    setIsInPosition(false);

    // Remove trading state from localStorage
    localStorage.removeItem('isInPosition');
    localStorage.removeItem('isTrading');
    localStorage.removeItem('initialTradingAmount');
    setIsTrading(false);
  };

  const calculateLiveProfitLoss = useCallback(() => {
    if (isInPosition && selectedToken) {
      const selectedTokenData = marketData.find((data) => data.symbol === selectedToken);
      if (selectedTokenData) {
        const percentageChange = parseFloat(selectedTokenData.change);
        const liveAmount = initialTradingAmount * (1 + percentageChange / 100);
        setLiveProfitLoss(liveAmount - initialTradingAmount);
      }
    }
  }, [isInPosition, selectedToken, marketData, initialTradingAmount]);

  useEffect(() => {
    calculateLiveProfitLoss();
  }, [calculateLiveProfitLoss]);

  return (
    <div>
      <h1 className="market-data-heading">
        Market Data
        <div className="settings-button-container">
          <button className="settings-button" onClick={() => setIsDialogOpen(true)} aria-label="Open Settings">
            ⚙️
          </button>
        </div>
      </h1>
      <div>
        <h1>Selected Token Info</h1>
        <p>Symbol: {tokenInfo.symbol}</p>
        <p>Price: {tokenInfo.price}</p>
        {selectedKlineInterval && <p>Change ({selectedKlineInterval} %): {`${tokenInfo.change}`}</p>}
        {!selectedKlineInterval && <p>Change (24h %): {`${tokenInfo.change}`}</p>}
        {tokenErrorMessage && <p style={{ color: 'red' }}>{tokenErrorMessage}</p>}
      </div>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change (24h %)</th>
          </tr>
        </thead>
        <tbody>
          {marketData.map((data) => (
            <tr key={data.symbol}>
              <td>{data.symbol}</td>
              <td>{data.price}</td>
              <td>{`${data.change}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h1>Trading Robot Settings</h1>
      <form>
        <Option
          label="Select Token"
          value={selectedToken}
          options={["", "BNB", "ETH", "BTC"]}
          onChange={handleTokenChange}
          disabled={isInPosition}
        />

        <Option
          label="Kline Interval"
          value={selectedKlineInterval}
          options={klineIntervalOptions}
          onChange={handleKlineIntervalChange}
          disabled={isInPosition}
        />

        <Option
          label="Select Trading Strategy"
          value={strategy}
          options={strategyOptions}
          onChange={setStrategy}
          disabled={isInPosition}
        />

        <Option
          label="Risk Level"
          value={riskLevel}
          options={[1, 2, 3, 4, 5]}
          onChange={setRiskLevel}
          disabled={isInPosition}
          riskMessage={calculateRiskMessage()}
        />

        <Option
          label="Target Profit (%)"
          value={targetProfit}
          options={[5, 10, 15, 20]}
          onChange={setTargetProfit}
          disabled={isInPosition}
        />
      </form>
      <button
        className={isInPosition || !selectedToken || !selectedKlineInterval ? 'disabled-button' : ''}
        onClick={startTrading}
        disabled={isInPosition || !selectedToken || !selectedKlineInterval}
      >
        Start Trading
      </button>
      <button
        className={!isInPosition ? 'enables-button' : ''}
        onClick={stopTrading}
        disabled={!isInPosition}
      >
        Stop Trading
      </button>
      <h2>Profit/Loss</h2>
      <p>Initial Balance: {initialBalance} ZAR</p>
      <p>Current Balance: {currentBalance} ZAR</p>
      {isInPosition && (
        <>
        <p>
        In Position: Yes (Amount: {Math.abs(initialTradingAmount + liveProfitLoss).toFixed(2)} ZAR)
      </p>
      <p>
        Profit/Loss: {liveProfitLoss.toFixed(2)} ZAR
      </p>
      </>
      )}


      <BinanceAPIDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
  );
};

Option.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  riskMessage: PropTypes.node, // This line is added for riskMessage prop
};

export default TradingRobot;
