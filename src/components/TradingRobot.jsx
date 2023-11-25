import { useState, useEffect, useCallback, useMemo } from 'react';
import './components_css/TradingRobot.css';
import BinanceAPIDialog from './BinanceAPIDialog.jsx';
import PropTypes from 'prop-types';

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

const getChangeSymbol = (change) => (change > 0 ? '+' : change < 0 ? '-' : '');

const TradingRobot = () => {
  const [strategy, setStrategy] = useState('MA_Crossover');
  const [riskLevel, setRiskLevel] = useState(1);
  const [targetProfit, setTargetProfit] = useState(5);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
  const [currentBalance] = useState(initialBalance);
  const [profitLoss] = useState(0);

  const strategyOptions = ['MA_Crossover', 'RSI_Overbought', 'CustomStrategy'];

  const klineIntervalOptions = ['', '1m', '5m', '15m', '30m', '1h'];

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
        const klineResponse = await fetch(`https://api.binance.com/api/v3/klines?symbol=${selectedToken}USDT&interval=${selectedKlineInterval}`);
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

  const fetchMarketData = useCallback(async () => {
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
  }, [tokenOptions]);

  useEffect(() => {
    fetchMarketData();

    const intervalId = setInterval(fetchMarketData, 5000);

    return () => clearInterval(intervalId);
  }, [fetchMarketData]);

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
        {selectedKlineInterval && <p>Change ({selectedKlineInterval} %): {`${getChangeSymbol(tokenInfo.change)}${tokenInfo.change}`}</p>}
        {!selectedKlineInterval && <p>Change (24h %): {`${getChangeSymbol(tokenInfo.change)}${tokenInfo.change}`}</p>}
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
              <td>{`${getChangeSymbol(data.change)}${data.change}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h1>Trading Robot Settings</h1>
      <form>
        <Option label="Select Token" value={selectedToken} options={["", "BNB", "ETH", "BTC"]} onChange={handleTokenChange} />
        <Option label="Kline Interval" value={selectedKlineInterval} options={klineIntervalOptions} onChange={handleKlineIntervalChange} />
        <div className="custom-strategy-container">
          <Option label="Select Trading Strategy" value={strategy} options={strategyOptions} onChange={setStrategy} />
          {strategy === 'CustomStrategy' && <button type="button">Edit</button>}
        </div>
        <Option label="Risk Level" value={riskLevel} options={[1, 2, 3, 4, 5]} onChange={setRiskLevel} />
        <Option label="Target Profit (%)" value={targetProfit} options={[5, 10, 15, 20]} onChange={setTargetProfit} />
      </form>
      <button>Start Trading</button>
      <h2>Profit/Loss</h2>
      <p>Initial Balance: ${initialBalance}</p>
      <p>Current Balance: ${currentBalance}</p>
      <p>Profit/Loss: ${profitLoss}</p>
      <BinanceAPIDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </div>
    
  );
};

Option.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  options: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default TradingRobot;
