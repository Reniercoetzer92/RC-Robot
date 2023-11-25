import { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './components_css/BinanceAPIDialog.css';

const BinanceAPIDialog = ({ isOpen, onClose }) => {
  const [selectedCoin, setSelectedCoin] = useState('');
  const [interval, setInterval] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleCoinChange = (e) => {
    setSelectedCoin(e.target.value);
  };

  const handleIntervalChange = (e) => {
    setInterval(e.target.value);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const bucketName = 'rc-robot-binance-api';
      const fileName = `${selectedCoin.toUpperCase()}USDT-data-${interval}.json`;
      const url = `https://storage.googleapis.com/${bucketName}/data/${fileName}`;

      console.log('Fetching data from:', url);

      const response = await fetch(url);

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const jsonData = await response.json();

      console.log('Fetched JSON Data:', jsonData);

      setData(jsonData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  }, [selectedCoin, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Modal isOpen={isOpen} onRequestClose={onClose}>
      <div className="refresh-button-container">
        <button className="refresh-button" onClick={fetchData}>
          Refresh
        </button>
      </div>

      <h2>Binance API Data</h2>
      <label>
        Select Coin:
        <select value={selectedCoin} onChange={handleCoinChange}>
          <option value="">Select Coin</option>
          <option value="BTC">BTC</option>
          <option value="ETH">ETH</option>
          <option value="BNB">BNB</option>
        </select>
      </label>
      <label>
        Select Interval:
        <select value={interval} onChange={handleIntervalChange}>
          <option value="">Select Interval</option>
          <option value="1M">1m</option>
          <option value="5M">5m</option>
          <option value="15M">15m</option>
          <option value="30M">30m</option>
          <option value="1H">1h</option>
        </select>
      </label>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table_info">
          <p>Displaying data for {selectedCoin}</p>
          <table>
            <thead>
              <tr>
                <th>Event Time</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>RSI</th>
                <th>Median Close</th>
                <th>Moving Average</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <td>{row.eventTime}</td>
                  <td>{row.open}</td>
                  <td>{row.high}</td>
                  <td>{row.low}</td>
                  <td>{row.close}</td>
                  <td
                    className={
                      parseInt(row.rsi) > 70
                        ? 'red-background'
                        : parseInt(row.rsi) < 30
                        ? 'green-background'
                        : ''
                    }
                  >
                    {parseInt(row.rsi)}
                  </td>
                  <td>{row.medianClose}</td>
                  <td>{row.movingAverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={onClose}>Close</button>
    </Modal>
  );
};

BinanceAPIDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default BinanceAPIDialog;
