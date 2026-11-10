#!/usr/bin/env bash
# Instala o Entende+ numa VPS Ubuntu 22.04: a interface e o servidor no mesmo
# endereço, com HTTPS pelo Caddy. Pode rodar de novo sem estragar nada.
#
# Na VPS, como root:
#   git clone https://github.com/EmmanuelGBL/Plataforma_Entende-.git /tmp/entende
#   bash /tmp/entende/implantar/instalar.sh
#
# O endereço padrão é o nome que a Hostinger deu à VPS. Para outro nome, que já
# precisa apontar para o IP da VPS: DOMINIO=exemplo.com.br bash instalar.sh
set -euo pipefail

DOMINIO="${DOMINIO:-srv1121242.hstgr.cloud}"
REPO="https://github.com/EmmanuelGBL/Plataforma_Entende-.git"
PASTA=/opt/entende
APP="$PASTA/app"
AQUI="$(cd "$(dirname "$0")" && pwd)"

passo() { printf '\n== %s\n' "$*"; }
falha() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || falha "rode como root."
grep -q '22.04' /etc/os-release || echo "Aviso: testado no Ubuntu 22.04."

passo "Conferindo as portas 80 e 443"
for porta in 80 443; do
  dono=$(ss -Htlnp "sport = :$porta" | grep -o 'users:(("[^"]*' | cut -d'"' -f2 | sort -u | tr '\n' ' ')
  if [ -n "$dono" ] && [ "$dono" != "caddy " ]; then
    falha "a porta $porta já está em uso por: $dono. O Caddy precisa dela para o HTTPS."
  fi
done

if [ -f /etc/caddy/Caddyfile ] && ! grep -q 'Entende+' /etc/caddy/Caddyfile \
   && ! grep -q '/usr/share/caddy' /etc/caddy/Caddyfile; then
  falha "/etc/caddy/Caddyfile já tem outra configuração. Junte o bloco de implantar/Caddyfile a ela à mão."
fi

passo "Pacotes do sistema"
apt-get update -q
apt-get install -y -q git curl gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v caddy >/dev/null; then
  passo "Caddy (servidor web com HTTPS automático)"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  passo "Node.js 22 (para construir a interface)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -q nodejs
fi

if ! command -v uv >/dev/null; then
  passo "uv (traz o Python 3.11; o Ubuntu 22.04 vem com o 3.10)"
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin INSTALLER_NO_MODIFY_PATH=1 sh
fi

passo "Usuário de sistema 'entende' (o servidor não roda como root)"
id entende >/dev/null 2>&1 || useradd --system --home-dir "$PASTA" --shell /usr/sbin/nologin entende
mkdir -p "$PASTA"
chown entende:entende "$PASTA"
chmod 755 "$PASTA"

como_entende() { sudo -u entende env HOME="$PASTA" UV_PYTHON_INSTALL_DIR="$PASTA/python" "$@"; }

passo "Código"
if [ -d "$APP/.git" ]; then
  como_entende git -C "$APP" pull --ff-only
else
  como_entende git clone "$REPO" "$APP"
fi

passo "Servidor: Python 3.11 e dependências"
[ -x "$APP/servidor/.venv/bin/python" ] || como_entende uv venv --python 3.11 "$APP/servidor/.venv"
como_entende uv pip install -q --python "$APP/servidor/.venv/bin/python" -r "$APP/servidor/requirements.txt"

ENV="$APP/servidor/.env"
if [ ! -f "$ENV" ]; then
  passo "Arquivo .env (fica só na VPS, nunca vai para o GitHub)"
  segredo=$(head -c 48 /dev/urandom | base64 | tr -d '/+=\n')
  cat > "$ENV" <<FIM
# Gerado por implantar/instalar.sh. Não versionar.
ENTENDE_SEGREDO_TOKEN=$segredo
# A interface fica no GitHub Pages e chama esta API de lá.
ENTENDE_ORIGENS=https://emmanuelgbl.github.io,https://$DOMINIO
ENTENDE_PROVEDOR=openai
# Chave da API da OpenAI, com limite de gasto definido no painel da OpenAI.
OPENAI_API_KEY=
FIM
  chown entende:entende "$ENV"
  chmod 600 "$ENV"
fi

passo "Interface ligada ao servidor de https://$DOMINIO"
como_entende bash -c "cd '$APP' && npm ci --no-audit --no-fund && VITE_API_URL='https://$DOMINIO' npm run build"

passo "Serviço do servidor (systemd)"
install -m 644 "$AQUI/entende.service" /etc/systemd/system/entende.service
systemctl daemon-reload
systemctl enable entende >/dev/null
systemctl restart entende

passo "Caddy"
sed "s/DOMINIO_AQUI/$DOMINIO/" "$AQUI/Caddyfile" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null
systemctl enable caddy >/dev/null
systemctl reload caddy 2>/dev/null || systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
fi

passo "Pronto"
echo "Endereço: https://$DOMINIO"
if ! grep -q '^OPENAI_API_KEY=.\+' "$ENV"; then
  echo
  echo "Falta a chave da OpenAI. Edite o arquivo:"
  echo "  nano $ENV"
  echo "e depois reinicie o servidor:"
  echo "  systemctl restart entende"
fi
