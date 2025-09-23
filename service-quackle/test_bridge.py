#!/usr/bin/env python3
"""
Test script for the Quackle bridge with minimal payloads
"""
import json
import subprocess
import os

BRIDGE_BIN = os.getenv("QUACKLE_BRIDGE_BIN", "./quackle_bridge")
QUACKLE_LEXICON = os.getenv("QUACKLE_LEXICON", "nwl18")
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

    # Case A: board {}, rack AEINRS? -> expect not pass
    resA = test_bridge({
        "board": {},
        "rack": [
            {"letter": "A", "points": 1, "isBlank": False},
            {"letter": "E", "points": 1, "isBlank": False},
            {"letter": "I", "points": 1, "isBlank": False},
            {"letter": "N", "points": 1, "isBlank": False},
            {"letter": "R", "points": 1, "isBlank": False},
            {"letter": "S", "points": 1, "isBlank": False},
            {"letter": "?", "points": 0, "isBlank": True}
        ],
        "difficulty": "medium"
    }, "Case A: Empty board + AEINRS?")
    if resA:
        print("ASSERT A move_type != pass:", resA.get('move_type') != 'pass')

    # Case B: malformed coordinate (0-based key used) -> expect error
    resB = test_bridge({
        "board": {
            "7,7": {"letter": "A", "points": 1, "isBlank": False}
        },
        "rack": [
            {"letter": "A", "points": 1, "isBlank": False},
            {"letter": "I", "points": 1, "isBlank": False},
            {"letter": "?", "points": 0, "isBlank": True}
        ],
        "difficulty": "medium"
    }, "Case B: 0-based key '7,7' (should error)")
    if resB:
        print("ASSERT B error present:", bool(resB.get('error')))

    # Case C: valid 1-based key '8,8' + small rack -> expect not pass
    resC = test_bridge({
        "board": {
            "8,8": {"letter": "A", "points": 1, "isBlank": False}
        },
        "rack": [
            {"letter": "A", "points": 1, "isBlank": False},
            {"letter": "I", "points": 1, "isBlank": False},
            {"letter": "?", "points": 0, "isBlank": True}
        ],
        "difficulty": "medium"
    }, "Case C: board '8,8' + AI?")
    if resC:
        print("ASSERT C move_type != pass:", resC.get('move_type') != 'pass')

if __name__ == "__main__":
    main()
