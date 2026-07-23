import time
import random
import uuid
import requests
from datetime import datetime, timezone

# Target main ingestion API URL
API_URL = "http://localhost:8000/api/packets"

def generate_hex_packet(device_id: int, packet_idx: int, total_packets: int) -> str:
    """
    Generates a single 246-byte raw hex packet representing:
    - Byte 0: Device ID (1 byte)
    - Bytes 1-240: 80 points of X, Y, Z coordinates (1 byte each, signed 8-bit)
    - Bytes 241-242: Current packet index (2 bytes, little-endian)
    - Bytes 243-244: Total packets (2 bytes, little-endian)
    - Byte 245: End of packet marker (FE)
    """
    tokens = []
    # 1. Device ID
    tokens.append(f"{device_id:02X}")
    
    # 2. 80 spatial coordinates
    for _ in range(80):
        # Generate realistic accelerometer readings
        x = int(random.gauss(60, 2))
        y = int(random.gauss(2, 1))
        z = int(random.gauss(-8, 2))
        
        # Clamp to signed 8-bit limits (-128 to 127)
        x = max(-128, min(127, x))
        y = max(-128, min(127, y))
        z = max(-128, min(127, z))
        
        # Convert to two's complement hex byte representation
        tokens.append(f"{(x & 0xFF):02X}")
        tokens.append(f"{(y & 0xFF):02X}")
        tokens.append(f"{(z & 0xFF):02X}")
        
    # 3. Current packet index (little-endian, 2 bytes)
    tokens.append(f"{(packet_idx & 0xFF):02X}")
    tokens.append(f"{((packet_idx >> 8) & 0xFF):02X}")
    
    # 4. Total packets (little-endian, 2 bytes)
    tokens.append(f"{(total_packets & 0xFF):02X}")
    tokens.append(f"{((total_packets >> 8) & 0xFF):02X}")
    
    # 5. End byte
    tokens.append("FE")
    
    return " ".join(tokens)

def run_simulation():
    print("==========================================================")
    print("   BLE Sense - DataLogger Device Simulation Engine       ")
    print("==========================================================")
    
    packet_counter = 0
    app_id = str(uuid.uuid4())
    total_packets = 915 # Constant research batch limit
    
    # Pre-calculate active device IDs to simulate a set of concurrent tags
    device_pool = [11, 42, 89, 93, 248]
    print(f"📡 Simulating {len(device_pool)} devices: {device_pool}")
    print(f"📱 Using App ID session: {app_id}")
    
    while True:
        try:
            # Select a random device from our pool
            simulated_device = random.choice(device_pool)
            
            # Generate a random number of packets to concatenate (1 to 6)
            num_packets = random.randint(1, 6)
            
            hex_parts = []
            start_idx = packet_counter
            for _ in range(num_packets):
                hex_parts.append(generate_hex_packet(simulated_device, packet_counter, total_packets))
                packet_counter += 1
            
            combined_hex = " ".join(hex_parts)
            
            # Format payload structure expected by the mobile app ingestion API
            now_ms = int(time.time() * 1000)
            now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            
            payload = {
                "_id": str(now_ms + random.randint(1, 100)),
                "timestamp": now_iso,
                "data": {
                    "timestamp": now_ms,
                    "data": {
                        "appId": app_id,
                        "rawData": combined_hex,
                        "type": "DataLogger"
                    }
                }
            }
            
            # Post to main FastAPI Backend Ingestion endpoint
            headers = {"Content-Type": "application/json"}
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 📤 Sending {num_packets} concatenated packet(s) (indices {start_idx} to {packet_counter - 1}) for Device {simulated_device}...")
            
            response = requests.post(API_URL, json=payload, headers=headers)
            
            if response.status_code in [200, 201, 202]:
                res_data = response.json()
                print(f"   ✓ Success ({response.status_code}) | Raw Database Packet ID: {res_data.get('raw_packet_id')}")
                if "processed_packets" in res_data:
                    for p in res_data["processed_packets"]:
                        print(f"     └─ Saved {p['type']} (Device {p['deviceId']}, Packet #{p.get('packetId', 'N/A')}) at {p['timestamp']}")
            else:
                print(f"   ❌ Failed with status code: {response.status_code} | Details: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Network/Exception Error occurred: {e}")
            
        # Wait for a random interval between 30 and 50 seconds before sending next batch
        sleep_duration = random.randint(30, 50)
        print(f"😴 Waiting {sleep_duration} seconds before next transmission...")
        time.sleep(sleep_duration)

if __name__ == "__main__":
    run_simulation()
