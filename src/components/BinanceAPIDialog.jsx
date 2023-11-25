import { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import Papa from 'papaparse';
import PropTypes from 'prop-types';
import "./components_css/BinanceAPIDialog.css"

const BinanceAPIDialog = ({ isOpen, onClose }) => {
  const [selectedCoin, setSelectedCoin] = useState('BTC'); // Default coin is ETH
  const [interval, setInterval] = useState('1m'); // Default interval is 1m
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const handleCoinChange = (e) => {
    setSelectedCoin(e.target.value);
  };

  const handleIntervalChange = (e) => {
    setInterval(e.target.value);
  };

  const fetchData = useCallback(() => {
    setLoading(true);

    // Append a timestamp to the URL to avoid caching
    const timestamp = new Date().getTime();
    const url = `data/${selectedCoin}USDT-data-${interval}.csv?timestamp=${timestamp}`;

    // Fetch data when the selected coin changes
    fetch(url)
      .then((response) => response.text())
      .then((csvData) => {
        Papa.parse(csvData, {
          header: true,
          complete: (result) => {
            const validRows = result.data
              .slice(-21)
              .filter(row => {
                // Filter out rows with invalid dates or other invalid values
                const eventTime = new Date(Number(row.event_time));
                return !isNaN(eventTime.getTime()) && !isNaN(parseFloat(row.rsi));
              });

            setData(validRows);
            setLoading(false);
          },
        });
      });
  }, [selectedCoin, interval]);

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Add fetchData to the dependency array

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
          <option value="BTC">BTC</option>
          <option value="ETH">ETH</option>
          <option value="BNB">BNB</option>
        </select>
      </label>
      <label>
        Select Coin:
        <select value={interval} onChange={handleIntervalChange}>
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
        <div className='table_info'>
          <p>Displaying data for {selectedCoin}</p>
          <table>
            <thead>
              <tr>
                {/* Remove the 'Symbol' column */}
                <th>Event Time</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>RSI</th>
                <th>Median Close</th>
                <th>Moving Average</th>
                {/* Add more table headers based on your CSV structure */}
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  {/* Remove the 'symbol' column */}
                  <td>{new Date(Number(row.event_time)).toLocaleString()}</td>
                  <td>{parseFloat(row.open).toFixed(2)}</td>
                  <td>{parseFloat(row.high).toFixed(2)}</td>
                  <td>{parseFloat(row.low).toFixed(2)}</td>
                  <td>{parseFloat(row.close).toFixed(2)}</td>
                  <td className={parseInt(row.rsi) > 70 ? 'red-background' : parseInt(row.rsi) < 30 ? 'green-background' : ''}>
                    {parseInt(row.rsi)}
                  </td>
                  <td>{parseFloat(row.median_close).toFixed(2)}</td>
                  <td>{parseFloat(row.moving_average).toFixed(2)}</td>
                  {/* Add more table cells based on your CSV structure */}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button onClick={onClose}>Close</button>
    </Modal>
  );
}

BinanceAPIDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired, 
};

export default BinanceAPIDialog;
