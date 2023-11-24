# type: ignore
from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from binance.client import Client
from binance.enums import ORDER_TYPE_MARKET
from flask import jsonify
import json
import talib
import numpy as np
import config
import threading
import websocket
import csv
import time
import os

file_paths = [
    'data/BNBUSDTdata.csv',
    'data/ETHUSDTdata.csv',
    'data/BTCUSDTdata.csv',
]

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, async_mode='threading')

SOCKET_ETH = "wss://stream.binance.com:9443/ws/ethusdt@kline_1m"
TRADE_SYMBOL_ETH = "ETHUSDT"

SOCKET_BNB = "wss://stream.binance.com:9443/ws/bnbusdt@kline_1m"
TRADE_SYMBOL_BNB = "BNBUSDT"

SOCKET_BTC = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m"
TRADE_SYMBOL_BTC = "BTCUSDT"

RSI_PERIOD = 2
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30
TRADE_QUANTITY = 0.03
closes = []
closes_eth = []
closes_bnb = []
closes_btc = []
last_candle_timestamp = None
in_position = False
client = Client(config.API_KEY, config.API_SECRET)


def order(side, quantity, symbol, order_type=ORDER_TYPE_MARKET):
    print("sending order")
    try:
        order = client.create_order(
            symbol=symbol,
            side=side,
            type=order_type,
            quantity=quantity
        )
        print(order)
        return True
    except Exception as e:   # noqa: F841
        return False


def on_open(ws):
    print("opened connection")


def on_close(ws):
    print("closed connection")


def on_message(ws, message, symbol):
    global closes_eth, closes_bnb, closes_btc, in_position

    print(f'Received message for {symbol}: {message}')

    if not message:
        print("Warning: Received empty message.")
        return

    try:
        json_message = json.loads(message)

        candle = json_message.get("k")
        if not candle:
            print("Warning: No candle data in the message.")
            return

        event_time = candle.get("T")
        is_candle_closed = candle.get("x")
        open_price = candle.get("o")
        high_price = candle.get("h")
        low_price = candle.get("l")
        close = candle.get("c")

        if (is_candle_closed and event_time is not None
                and open_price is not None and close is not None):
            print(f"Candle closed at {close} for {symbol}")

            # Append the close to the corresponding list based on the symbol
            if symbol == TRADE_SYMBOL_ETH:
                closes_eth.append(float(close))
                current_closes = closes_eth
            elif symbol == TRADE_SYMBOL_BNB:
                closes_bnb.append(float(close))
                current_closes = closes_bnb
            elif symbol == TRADE_SYMBOL_BTC:
                closes_btc.append(float(close))
                current_closes = closes_btc
            else:
                # Handle other symbols if needed
                return

            print("Closes:")
            print(current_closes)

            print("Length of Closes:", len(current_closes))
            if len(current_closes) > RSI_PERIOD:
                np_closes = np.array(current_closes)
                rsi = talib.RSI(np_closes, RSI_PERIOD)
                last_rsi = rsi[-1]
                rsi_values = talib.RSI(np_closes, RSI_PERIOD)
                print("Closes array:", np_closes)
                print("RSI Values:", rsi_values)
                print("Last RSI:", last_rsi)

                # Calculate and print the median
                median_close = np.median(np_closes)
                print("Median Close:", median_close)

                # Check RSI conditions
                if last_rsi < RSI_OVERSOLD and not in_position:
                    print("Buy buy buy!")
                    in_position = True
                    # You can place your buy order
                    # here using the order() function

                elif last_rsi > RSI_OVERBOUGHT and in_position:
                    print("Sell sell sell!")
                    in_position = False
                    # You can place your sell order
                    # here using the order() function

            # Calculate the simple moving average (SMA)
            if len(current_closes) >= RSI_PERIOD:
                moving_average = talib.SMA(
                    np_closes, timeperiod=RSI_PERIOD)[-1]
                print("Moving Average:", moving_average)

                # Emit the data to the front end
                data = {
                    "symbol": symbol,
                    "event_time": event_time,
                    "open": open_price,
                    "high": high_price,
                    "low": low_price,
                    "close": close,
                    "rsi": last_rsi,
                    "median_close": median_close,
                    "moving_average": moving_average
                    }
                socketio.emit('update_data', json.dumps(data))
                print("Data emitted to front end:", data)

                # Write data to specific CSV files for each symbol
                csv_file_path = f'data/{symbol}data.csv'
                write_data_to_csv(csv_file_path, symbol, data)

    except Exception as e:
        print(f"Error processing message for {symbol}: {e}")


def write_data_to_csv(csv_file_path, symbol, data):
    print(f"Writing data to CSV for {symbol}...")
    is_new_file = not os.path.isfile(csv_file_path)

    fieldnames = [
        "symbol",
        "event_time",
        "open",
        "high",
        "low",
        "close",
        "rsi",
        "median_close",
        "moving_average",
    ]

    with open(csv_file_path, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        if is_new_file or csvfile.tell() == 0:
            writer.writeheader()

        row_data = {
            "symbol": symbol,
            "event_time": data["event_time"],
            "open": data["open"],
            "high": data["high"],
            "low": data["low"],
            "close": data["close"],
            "rsi": data["rsi"],
            "median_close": data["median_close"],
            "moving_average": data["moving_average"],
        }

        print("Row Data:", row_data)
        writer.writerow(row_data)


def start_websocket(symbol, socket_url):
    while True:
        try:
            # Create WebSocketApp instance
            ws = websocket.WebSocketApp(socket_url,
                                        on_open=on_open,
                                        on_close=on_close)
            ws.on_message = lambda ws, msg: on_message(ws, msg, symbol)

            # Run WebSocket connection
            ws.run_forever()

        except Exception as e:
            # Print error message
            print(f"Error in WebSocket connection for {symbol}: {e}")

        finally:
            # Add a delay before retrying the connection
            time.sleep(5)


@app.route('/run_python_script', methods=['POST'])
def run_python_script():
    # Execute your Python script here
    os.system('/app.py')
    return jsonify({'status': 'success'})


if __name__ == '__main__':
    socketio.run(app, debug=True, threaded=True)

    websocket_thread_eth = threading.Thread(
        target=start_websocket, args=(TRADE_SYMBOL_ETH, SOCKET_ETH)
    )
    websocket_thread_bnb = threading.Thread(
        target=start_websocket, args=(TRADE_SYMBOL_BNB, SOCKET_BNB)
    )
    websocket_thread_btc = threading.Thread(
        target=start_websocket, args=(TRADE_SYMBOL_BTC, SOCKET_BTC)
    )

    # Start all WebSocket threads
    websocket_thread_eth.start()
    websocket_thread_bnb.start()
    websocket_thread_btc.start()

    # Wait for all WebSocket threads to finish
    websocket_thread_eth.join()
    websocket_thread_bnb.join()
    websocket_thread_btc.join()
