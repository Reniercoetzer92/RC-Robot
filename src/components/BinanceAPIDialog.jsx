import { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import "./components_css/BinanceAPIDialog.css"

Modal.setAppElement('#root');

// Helper function to check if a value is a valid number
const isValidNumber = (value) => !isNaN(parseFloat(value)) && isFinite(value);

// Function to parse CSV data
const parseCsvData = (csvString) => {
  const rows = csvString.split('\n');
  const headers = rows[0].split(',');

  // Filter out empty lines
  const nonEmptyRows = rows.filter(row => row.trim() !== '');

  return nonEmptyRows.slice(1).map((row) => {
    const values = row.split(',');
    return headers.reduce((obj, header, index) => {
      const value = values[index] ? values[index].trim() : '';
      obj[header.trim()] = value;
      return obj;
    }, {});
  });
};

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

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      if (!selectedCoin || !interval) {
        throw new Error('Select both coin and interval to fetch data.');
      }

      const symbol = selectedCoin.toUpperCase();
      const fileName = `${symbol}USDT_${interval}_trading_data.csv`;
      const csvFilePath = `data/csv_files/${fileName}`;

      const response = await fetch(csvFilePath);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const csvData = await response.text();
      const parsedData = parseCsvData(csvData);

      const formattedData = parsedData.map((item) => ({
        eventTime: new Date(Number(item['Event Time'])).toLocaleString(),
        open: isValidNumber(item.Open) ? parseFloat(item.Open).toFixed(2) : 'N/A',
        high: isValidNumber(item.High) ? parseFloat(item.High).toFixed(2) : 'N/A',
        low: isValidNumber(item.Low) ? parseFloat(item.Low).toFixed(2) : 'N/A',
        close: isValidNumber(item.Close) ? parseFloat(item.Close).toFixed(2) : 'N/A',
        rsi: isValidNumber(item.RSI) ? Math.round(item.RSI) : 'N/A',
        medianClose: isValidNumber(item['Median Close']) ? parseFloat(item['Median Close']).toFixed(2) : 'N/A',
        movingAverage: isValidNumber(item['Moving Average']) ? parseFloat(item['Moving Average']).toFixed(2) : 'N/A',
      }));

      setData(formattedData);
    } catch (error) {
      console.error('Error fetching data:', error.message);
    } finally {
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
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="15m">15m</option>
          <option value="30m">30m</option>
          <option value="1h">1h</option>
        </select>
      </label>

      {loading ? (
  <p>Loading...</p>
    ) : (
      <div className="table_info">
        {selectedCoin && interval ? (
          <div>
            <p>Displaying data for {selectedCoin}_{interval}</p>
            <table>
              <thead className='Dialog'>
                <tr className='Dialog-tr'>
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
              <tbody style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {data
                  .slice()
                  .reverse()
                  .filter((row) => Object.values(row).some((value) => value !== 'N/A'))
                  .map((row, index) => (
                    <tr key={index}>
                      <td>{row.eventTime}</td>
                      <td>{row.open}</td>
                      <td>{row.high}</td>
                      <td>{row.low}</td>
                      <td>{row.close}</td>
                      <td
                        className={
                          row.rsi > 70
                            ? 'red-background'
                            : row.rsi < 30
                            ? 'green-background'
                            : ''
                        }
                      >
                        {row.rsi}
                      </td>
                      <td>{row.medianClose}</td>
                      <td>{row.movingAverage}</td>
                    </tr>
                  ))}
              </tbody>

            </table>
          </div>
        ) : (
          <p>Select both coin and interval to display data.</p>
        )}
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
