import sys
import pathlib

# Aggiunge la cartella service-quackle-min al PYTHONPATH così che 'app' sia importabile
ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))