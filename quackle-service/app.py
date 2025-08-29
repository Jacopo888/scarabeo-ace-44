from flask import Flask, request, jsonify
from flask_cors import CORS
import quackle
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Initialize Quackle
quackle_game = None

def init_quackle():
    """Initialize Quackle game engine"""
    global quackle_game
    try:
        quackle_game = quackle.Game()
        quackle_game.setLayout("scrabble")  # Use standard Scrabble layout
        quackle_game.setLexicon("en-enable")  # Use ENABLE lexicon
        logger.info("Quackle initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Quackle: {e}")
        return False

def board_to_quackle_format(board):
    """Convert board from JavaScript format to Quackle format"""
    quackle_board = [[' ' for _ in range(15)] for _ in range(15)]
    
    for key, tile in board.items():
        row, col = map(int, key.split(','))
        letter = tile['letter'].upper() if tile['letter'] else ' '
        quackle_board[row][col] = letter
    
    return quackle_board

def rack_to_quackle_format(rack):
    """Convert rack from JavaScript format to Quackle format"""
    quackle_rack = ""
    for tile in rack:
        if tile.get('isBlank', False):
            quackle_rack += "?"
        else:
            quackle_rack += tile['letter'].upper()
    return quackle_rack

def get_simulation_count(difficulty):
    """Map difficulty to simulation count"""
    difficulty_map = {
        'easy': 0,      # No simulations - just greedy
        'medium': 300,  # Medium simulations
        'hard': 800     # High simulations
    }
    return difficulty_map.get(difficulty, 300)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "quackle_ready": quackle_game is not None})

@app.route('/best-move', methods=['POST'])
def get_best_move():
    """Get best move from Quackle engine"""
    try:
        if not quackle_game:
            return jsonify({"error": "Quackle not initialized"}), 500
        
        data = request.get_json()
        
        # Extract data from request
        board = data.get('board', {})
        rack = data.get('rack', [])
        difficulty = data.get('difficulty', 'medium')
        
        logger.info(f"Received move request - difficulty: {difficulty}, rack: {rack}")
        
        # Convert formats
        quackle_board = board_to_quackle_format(board)
        quackle_rack = rack_to_quackle_format(rack)
        
        # Set up game state
        quackle_game.setBoard(quackle_board)
        quackle_game.setRack(quackle_rack)
        
        # Get simulation count based on difficulty
        simulation_count = get_simulation_count(difficulty)
        
        # Generate move
        if simulation_count > 0:
            move = quackle_game.getBestMove(simulation_count)
        else:
            move = quackle_game.getBestMoveGreedy()
        
        # Convert move back to JavaScript format
        result = {
            "tiles": [],
            "score": move.get('score', 0),
            "words": move.get('words', []),
            "move_type": "place"
        }
        
        # Convert tile placements
        if 'tiles' in move:
            for tile_move in move['tiles']:
                result["tiles"].append({
                    "row": tile_move['row'],
                    "col": tile_move['col'],
                    "letter": tile_move['letter'],
                    "points": tile_move['points'],
                    "isBlank": tile_move.get('isBlank', False)
                })
        
        logger.info(f"Generated move: {result}")
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error generating move: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/ping', methods=['GET'])
def ping():
    """Simple ping endpoint"""
    return jsonify({"message": "pong"})

if __name__ == '__main__':
    if init_quackle():
        app.run(host='0.0.0.0', port=5000, debug=False)
    else:
        logger.error("Failed to start: Quackle initialization failed")
        exit(1)