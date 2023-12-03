# type: ignore
from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS
from binance.client import Client
from binance.enums import ORDER_TYPE_MARKET
from websocket import create_connection
import json
import numpy as np
import threading
import time
import config
import csv
import os

# CSV file path
csv_file_path = 'data/trading_data.csv'

bucket_name = 'rc-robot-binance-api'

# CSV header
csv_header = [
    'Event Time',
    'Open',
    'High',
    'Low',
    'Close',
    'RSI',
    'Median Close',
    'Moving Average'
    ]


RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30
closes_eth = []
closes_bnb = []
closes_btc = []
in_position = False
client = Client(config.API_KEY, config.API_SECRET)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, async_mode='threading')

# Directory for CSV files
csv_directory = 'data/csv_files'
os.makedirs(csv_directory, exist_ok=True)

trading_symbol = ['ETH', 'BNB', 'BTC']
intervals = ['1m', '5m', '15m', '30m', '1h']
trading_symbol_usdt = "USDT"

TRADE_SYMBOL_ETH = "ETHUSDT"
TRADE_SYMBOL_BNB = "BNBUSDT"
TRADE_SYMBOL_BTC = "BTCUSDT"

# Open CSV file in write mode and write the header
with open(csv_file_path, 'w', newline='') as csv_file:
    csv_writer = csv.writer(csv_file)
    csv_writer.writerow(csv_header)


def get_csv_file_path(symbol, interval):
    return os.path.join(csv_directory, f'{symbol}_{interval}_trading_data.csv')


def order(side, quantity, symbol, order_type=ORDER_TYPE_MARKET):
    # print("sending order")
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


def calculate_rsi(np_closes):
    # Calculate RSI manually
    diff = np.diff(np_closes)

    avg_gain = np.mean(np.maximum(diff, 0))
    avg_loss = -np.mean(np.minimum(diff, 0))

    rs = avg_gain / (avg_loss + 1e-10)
    rsi = 100 - (100 / (1 + rs))

    return rsi


def on_message(ws, message, symbol, interval):
    global closes_eth, closes_bnb, closes_btc, in_position

    # print(f"Received message for {symbol}: {message}")

    if not message:
        # print("Warning: Received an empty message.")
        return

    try:
        json_message = json.loads(message)

        candle = json_message.get("k")
        if not candle:
            # print("Warning: No candle data in the message.")
            return

        event_time = candle.get("T")
        is_candle_closed = candle.get("x")
        open_price = candle.get("o")
        high_price = candle.get("h")
        low_price = candle.get("l")
        close = candle.get("c")

        if (is_candle_closed and event_time is not None
                and open_price is not None and close is not None):
            # print(f"Candle closed at {close} for {symbol}")

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

            # print("Closes:")
            # print(current_closes)

            # print("Length of Closes:", len(current_closes))
            if len(current_closes) >= RSI_PERIOD:
                np_closes = np.array(current_closes)
                last_rsi = calculate_rsi(np_closes)

                median_close = np.median(np_closes)

                if last_rsi < RSI_OVERSOLD and not in_position:
                    in_position = True
                    # You can place your buy order here using the order() function

                elif last_rsi > RSI_OVERBOUGHT and in_position:
                    in_position = False
                    # You can place your sell order here using the order() function

                if len(current_closes) >= RSI_PERIOD:
                    moving_average = np.mean(current_closes[-RSI_PERIOD:])

                    # Write data to CSV
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

                    csv_file_path = get_csv_file_path(symbol, interval)
                    write_data_to_csv(csv_file_path, data)

    except Exception as e:
        print(f"Error processing message for {symbol}: {e}")
        return


def write_data_to_csv(csv_file_path, data):
    with open(csv_file_path, 'a', newline='') as csv_file:
        csv_writer = csv.writer(csv_file)
        if os.path.getsize(csv_file_path) == 0:  # Check if file is empty
            csv_writer.writerow(['Symbol',
                                 'Event Time',
                                 'Open',
                                 'High',
                                 'Low',
                                 'Close',
                                 'RSI',
                                 'Median Close',
                                 'Moving Average'
                                 ])
        csv_writer.writerow([
            data['symbol'],
            data['event_time'],
            data['open'],
            data['high'],
            data['low'],
            data['close'],
            data['rsi'],
            data['median_close'],
            data['moving_average']
        ])


def start_websocket(symbol, interval, socket_url):
    while True:
        try:
            # Create WebSocket connection
            ws = create_connection(socket_url)
            print("Opened connection")

            # Run WebSocket connection
            while True:
                message = ws.recv()
                on_message(ws, message, symbol, interval)

        # except Exception as e:
            # Print error message
            # print(f"Error in WebSocket connection for {symbol}: {e}")

        finally:
            # Close the WebSocket connection
            ws.close()
            print("Closed connection")

            # Add a delay before retrying the connection
            time.sleep(5)


if __name__ == '__main__':
    basepath = "wss://stream.binance.com:9443/ws/"
    sockets = []

    for symbol in trading_symbol:
        for interval in intervals:
            socket = f"{basepath}{symbol}{trading_symbol_usdt}@kline_{interval}".lower()

            websocket_thread = threading.Thread(
                target=start_websocket, args=(
                    f"{symbol}{trading_symbol_usdt}".upper(), interval, socket)
            )
            sockets.append(websocket_thread)

    for websocket_thread in sockets:
        websocket_thread.start()

    for websocket_thread in sockets:
        websocket_thread.join()
