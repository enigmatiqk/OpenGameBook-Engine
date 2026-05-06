#!/bin/bash

# Gamebook Engine Server - Linux/Mac
# Port: 8080

PORT=8080

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$(dirname "$SCRIPT_DIR")/dist"
ADVENTURES_DIR="$DIST_DIR/adventures"

echo ""
echo -e "${GREEN}🚀 Gamebook Engine Server${NC}"
echo "📁 Serving from: $DIST_DIR"
echo "🎮 Adventures directory: $ADVENTURES_DIR"

# ─── Régénérer le manifest ───────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}📋 Regenerating manifest.json...${NC}"

# Créer le répertoire adventures s'il n'existe pas
mkdir -p "$ADVENTURES_DIR"

# Créer le manifest
manifest_file="$ADVENTURES_DIR/manifest.json"
echo "{" > "$manifest_file"
echo '  "adventures": [' >> "$manifest_file"

first=true
for dir in "$ADVENTURES_DIR"/*; do
    if [ -d "$dir" ]; then
        dir_name=$(basename "$dir")
        # Vérifier que couverture.json existe
        if [ -f "$dir/couverture.json" ]; then
            if [ "$first" = true ]; then
                first=false
            else
                echo "," >> "$manifest_file"
            fi
            echo -n "    { \"path\": \"$dir_name\" }" >> "$manifest_file"
            echo -e "  ${GREEN}✓${NC} $dir_name"
        else
            echo -e "  ${RED}✗${NC} $dir_name (missing couverture.json)"
        fi
    fi
done

echo "" >> "$manifest_file"
echo "  ]" >> "$manifest_file"
echo "}" >> "$manifest_file"

echo -e "${GREEN}✅ Manifest updated${NC}"

# ─── Démarrer le serveur ─────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}✅ Starting HTTP server on port $PORT${NC}"
echo -e "${GREEN}📖 Open your browser: http://localhost:$PORT${NC}"
echo ""
echo -e "${YELLOW}⏹️  Press Ctrl+C to stop the server${NC}"
echo ""

cd "$DIST_DIR"
python3 -m http.server $PORT
