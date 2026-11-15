#!/usr/bin/env bash
# start.sh -- equivalent bash de start.ps1 :
#     pyenv-win-venv.ps1 activate ia
#     python main.py --listen --port 8188
#
# Active le venv Python "ia" puis lance ComfyUI en mode ecoute.
# A executer depuis le repertoire d'installation de ComfyUI
# (celui qui contient main.py), exactement comme start.ps1.
#
# Exemples :
#     bash start.sh                 # port 8188 par defaut
#     PORT=8282 bash start.sh        # changer le port
#     VENV_NAME=comfy bash start.sh  # autre nom de venv

set -euo pipefail

VENV_NAME="${VENV_NAME:-ia}"
PORT="${PORT:-8188}"

# --- Activation du venv "ia" (equivalent de pyenv-win-venv.ps1 activate ia) ---
if command -v pyenv >/dev/null 2>&1 && pyenv commands 2>/dev/null | grep -qx activate; then
    # pyenv-win ou pyenv-virtualenv
    pyenv activate "$VENV_NAME"
elif [ -f "$HOME/.pyenv/versions/$VENV_NAME/bin/activate" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.pyenv/versions/$VENV_NAME/bin/activate"
elif [ -f ".venv/Scripts/activate" ]; then
    # venv Windows vu depuis Git Bash
    # shellcheck disable=SC1091
    source ".venv/Scripts/activate"
elif [ -f ".venv/bin/activate" ]; then
    # venv Linux/macOS
    # shellcheck disable=SC1091
    source ".venv/bin/activate"
else
    echo "[start.sh] venv << ${VENV_NAME} >> introuvable -- utilisation du python du PATH." >&2
fi

exec python main.py --listen --port "$PORT"
