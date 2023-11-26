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
from google.cloud import storage
import os

# Set the path to your JSON key file
json_key_file = "fleet-bus-406205-5ec1e3043ec6.json"

# Get the full path to the JSON key file
json_key_file_path = os.path.abspath(json_key_file)

# Set the GOOGLE_APPLICATION_CREDENTIALS environment variable
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = json_key_file_path

API_KEY = "SBEJtJ8d8gxKiEe9jZh2FfSTjDutZKCtV8xrJzJJXMFqXFi37DYWNtAe0MEsgBQb"
API_SECRET = "oOMCGcLzzDHn98Wx3yZoZgAji3OsDq5BdfWOqMXfYKCGhf6ekXatAsb1L2V7yQoJ"

bucket_name = 'rc-robot-binance-api'

RSI_PERIOD = 14
RSI_OVERBOUGHT = 70
RSI_OVERSOLD = 30
closes_eth = []
closes_bnb = []
closes_btc = []
in_position = False
client = Client(API_KEY, API_SECRET)

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, async_mode='threading')

trading_symbol = ['ETH', 'BNB', 'BTC']
intervals = ['1m', '5m', '15m', '30m', '1h']
trading_symbol_usdt = "USDT"

TRADE_SYMBOL_ETH = "ETHUSDT"
TRADE_SYMBOL_BNB = "BNBUSDT"
TRADE_SYMBOL_BTC = "BTCUSDT"


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
            if len(current_closes) > RSI_PERIOD:
                np_closes = np.array(current_closes)
                last_rsi = calculate_rsi(np_closes)
                # print("Closes array:", np_closes)
                # print("Last RSI:", last_rsi)

                # Calculate and print the median
                median_close = np.median(np_closes)
                # print("Median Close:", median_close)

                # Check RSI conditions
                if last_rsi < RSI_OVERSOLD and not in_position:
                    # print("Buy buy buy!")
                    in_position = True
                    # You can place your buy order
                    # here using the order() function

                elif last_rsi > RSI_OVERBOUGHT and in_position:
                    # print("Sell sell sell!")
                    in_position = False
                    # You can place your sell order
                    # here using the order() function

            # Calculate the simple moving average (SMA)
            if len(current_closes) >= RSI_PERIOD:
                moving_average = np.mean(current_closes[-RSI_PERIOD:])
                # print("Moving Average:", moving_average)

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
                # print("Data emitted to front end:", data)

                # Write data to Google Cloud Storage
                write_data_to_gcs('rc-robot-binance-api', symbol, interval, data)

    except Exception as e:
        print(f"Error processing message for {symbol}: {e}")
        return


def write_data_to_gcs(bucket_name, symbol, interval, data):
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    file_name = f'data/{symbol}-data-{interval}.json'

    blob = bucket.blob(file_name)

    try:
        # Download existing content or create an empty list if the file doesn't exist
        existing_content = json.loads(blob.download_as_text()) if blob.exists() else []

        # Append the new data to the existing content
        existing_content.append(data)

        # Upload the updated content back to the blob
        blob.upload_from_string(
            json.dumps(existing_content),
            content_type='application/json'
        )

    except Exception as e:
        print(f"Error writing data to JSON for {symbol}: {e}")

    # print(f"File {file_name} uploaded to {bucket_name}.")


def start_websocket(symbol, interval, socket_url):
    while True:
        try:
            # Create WebSocket connection
            ws = create_connection(socket_url)
            # print("Opened connection")

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
            # print("Closed connection")

            # Add a delay before retrying the connection
            time.sleep(5)


if __name__ == '__main__':
    basepath = "wss://stream.binance.com:9443/ws/"
    sockets = []
    for symbol in trading_symbol:
        for interval in intervals:
            # Corrected string concatenation
            socket = f"{basepath}{symbol}{trading_symbol_usdt}@kline_{interval}".lower()

            # print(socket)

            # Create a WebSocket thread and append it to the list
            websocket_thread = threading.Thread(
                target=start_websocket, args=(
                    f"{symbol}{trading_symbol_usdt}".upper(), interval, socket)
            )
            sockets.append(websocket_thread)

    for websocket_thread in sockets:
        websocket_thread.start()

    for websocket_thread in sockets:
        websocket_thread.join()
