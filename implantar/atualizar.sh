#!/usr/bin/env bash
# Atualiza o servidor do Entende+ na VPS com o que está na branch main do GitHub.
# Na VPS, como root:  bash /opt/entende/app/implantar/atualizar.sh
set -euo pipefail

PASTA=/opt/entende
APP="$PASTA/app"
como_entende() { (cd / && runuser -u entende -- env HOME="$PASTA" UV_PYTHON_INSTALL_DIR="$PASTA/python" "$@"); }

como_entende git -C "$APP" pull --ff-only
como_entende uv pip install -q --python "$APP/servidor/.venv/bin/python" -r "$APP/servidor/requirements.txt"
install -m 644 "$APP/implantar/entende.service" /etc/systemd/system/entende.service
systemctl daemon-reload
systemctl restart entende
echo "Atualizado: $(como_entende git -C "$APP" log -1 --format='%h %s')"
