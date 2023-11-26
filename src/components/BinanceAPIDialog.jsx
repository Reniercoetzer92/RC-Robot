import { useState, useEffect, useCallback } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import './components_css/BinanceAPIDialog.css';
import { w3cwebsocket as W3CWebSocket } from 'websocket';

Modal.setAppElement('#root'); // Set the app element

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
    // Update the body overflow style based on the dialog's open state
    document.body.style.overflow = isOpen ? 'hidden' : 'auto';

    return () => {
      // Revert the body overflow style when the component is unmounted
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const fetchData = useCallback(async () => {
    setLoading(true);
  
    try {
      if (!selectedCoin || !interval) {
        setLoading(false);
        return;
      }
  
      const url = `http://localhost:3001/api/data/${selectedCoin}/${interval}?cacheBuster=${new Date().getTime()}`;
  
      const response = await fetch(url, { mode: 'cors' });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const jsonData = await response.json();
  
      // const latestData = jsonData.slice(0, 20);
  
      const formattedData = jsonData.map((item) => ({
        symbol: item.symbol,
        eventTime: new Date(item.event_time).toLocaleString(),
        open: parseFloat(item.open).toFixed(2),
        high: parseFloat(item.high).toFixed(2),
        low: parseFloat(item.low).toFixed(2),
        close: parseFloat(item.close).toFixed(2),
        rsi: Math.round(item.rsi),
        medianClose: parseFloat(item.median_close).toFixed(2),
        movingAverage: parseFloat(item.moving_average).toFixed(2),
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

  useEffect(() => {
    const ws = new W3CWebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('WebSocket connected');
      // Set the coin and interval properties on the WebSocket instance
      ws.send(JSON.stringify({ coin:selectedCoin, interval: interval }));
    };

    ws.onmessage = (message) => {
      try {
        const jsonData = JSON.parse(message.data);
        setData(jsonData);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error.message);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [selectedCoin, interval]);

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
                <tbody style={{ overflow: 'auto' }}>
                  {data.map((row, index) => (
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
