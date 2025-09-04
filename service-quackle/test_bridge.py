#!/usr/bin/env python3
"""
Test script for the Quackle bridge with minimal payloads
"""
import json
import subprocess
import os

BRIDGE_BIN = os.getenv("QUACKLE_BRIDGE_BIN", "/usr/local/bin/quackle_bridge")
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "en-enable")
QUACKLE_LEXDIR = os.getenv("QUACKLE_LEXDIR", "/usr/share/quackle/lexica")

def test_bridge(payload, test_name):
    print(f"\n=== {test_name} ===")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        proc = subprocess.run(
            [BRIDGE_BIN, "--lexicon", QUACKLE_LEXICON, "--lexdir", QUACKLE_LEXDIR],
            input=json.dumps(payload).encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
        )
        
        print(f"Return code: {proc.returncode}")
        
        stdout_output = proc.stdout.decode("utf-8").strip()
        stderr_output = proc.stderr.decode("utf-8")
        
        print(f"STDOUT: {stdout_output}")
        if stderr_output:
            print(f"STDERR: {stderr_output}")
        
        if stdout_output:
            try:
                result = json.loads(stdout_output)
                print(f"Parsed result: {json.dumps(result, indent=2)}")
                return result
            except json.JSONDecodeError as e:
                print(f"JSON parse error: {e}")
        
    except subprocess.TimeoutExpired:
        print("TIMEOUT: Bridge took too long")
    except Exception as e:
        print(f"ERROR: {e}")
    
    return None

def main():
    print("Testing Quackle Bridge with various payloads...")
    
    # Test 1: Empty board, simple rack
    test_bridge({
        "board": {},
        "rack": [
            {"letter": "A", "points": 1, "isBlank": False},
            {"letter": "B", "points": 3, "isBlank": False},
            {"letter": "C", "points": 3, "isBlank": False},
            {"letter": "D", "points": 2, "isBlank": False},
            {"letter": "E", "points": 1, "isBlank": False},
            {"letter": "F", "points": 4, "isBlank": False},
            {"letter": "G", "points": 2, "isBlank": False}
        ],
        "difficulty": "medium"
    }, "Test 1: Empty board, simple rack")
    
    # Test 2: Empty board, rack with blank
    test_bridge({
        "board": {},
        "rack": [
            {"letter": "?", "points": 0, "isBlank": True},
            {"letter": "A", "points": 1, "isBlank": False},
            {"letter": "B", "points": 3, "isBlank": False},
            {"letter": "C", "points": 3, "isBlank": False},
            {"letter": "D", "points": 2, "isBlank": False},
            {"letter": "E", "points": 1, "isBlank": False},
            {"letter": "F", "points": 4, "isBlank": False}
        ],
        "difficulty": "medium"
    }, "Test 2: Empty board, rack with blank")
    
    # Test 3: Board with one tile, simple rack
    test_bridge({
        "board": {
            "8,8": {"letter": "A", "points": 1, "isBlank": False}
        },
        "rack": [
            {"letter": "B", "points": 3, "isBlank": False},
            {"letter": "C", "points": 3, "isBlank": False},
            {"letter": "D", "points": 2, "isBlank": False},
            {"letter": "E", "points": 1, "isBlank": False},
            {"letter": "F", "points": 4, "isBlank": False},
            {"letter": "G", "points": 2, "isBlank": False},
            {"letter": "H", "points": 4, "isBlank": False}
        ],
        "difficulty": "medium"
    }, "Test 3: Board with one tile")
    
    # Test 4: Minimal rack
    test_bridge({
        "board": {},
        "rack": [
            {"letter": "A", "points": 1, "isBlank": False},
            {"letter": "B", "points": 3, "isBlank": False}
        ],
        "difficulty": "medium"
    }, "Test 4: Minimal rack (2 tiles)")

if __name__ == "__main__":
    main()

