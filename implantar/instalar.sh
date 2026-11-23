#!/usr/bin/env bash
# Instala o servidor do Entende+ numa VPS Ubuntu que já usa o nginx para outros
# sistemas. A interface fica no GitHub Pages; aqui fica só a API, com HTTPS.
# Pode rodar de novo sem estragar nada.
#
# Na VPS, como root:
#   git clone https://github.com/EmmanuelGBL/Plataforma_Entende-.git /tmp/entende
#   bash /tmp/entende/implantar/instalar.sh
#
# O que muda no nginx: entra um arquivo novo, "zz-entende". Nenhum arquivo dos
# outros sites é alterado, e o arquivo novo sai se "nginx -t" o recusar.
#
# Outro endereço, que já precisa apontar para o IP da VPS: DOMINIO=exemplo.com.br
# E-mail do certificado, pedido só se o certbot ainda não tiver conta: EMAIL=...
set -euo pipefail

DOMINIO="${DOMINIO:-srv1121242.hstgr.cloud}"
PAGES="https://emmanuelgbl.github.io"
REPO="https://github.com/EmmanuelGBL/Plataforma_Entende-.git"
PASTA=/opt/entende
APP="$PASTA/app"
ACME=/var/www/entende-acme
AQUI="$(cd "$(dirname "$0")" && pwd)"

passo() { printf '\n== %s\n' "$*"; }
falha() { printf '\nERRO: %s\n' "$*" >&2; exit 1; }
falta() { ! command -v "$1" >/dev/null; }

[ "$(id -u)" -eq 0 ] || falha "rode como root."

passo "Conferindo o nginx, sem mudar nada"
falta nginx && falha "esta VPS não tem nginx, e este instalador depende dele."
nginx -t 2>/dev/null || falha "a configuração atual do nginx já está com erro (rode: nginx -t). Nada foi mudado."
config="$(nginx -T 2>/dev/null)"
grep -q 'include /etc/nginx/sites-enabled/' <<<"$config" || falha "o nginx não lê /etc/nginx/sites-enabled."
# Site preso a um IP ganha do nosso, que escuta em todos; o pedido não chegaria aqui.
if grep -qE '^\s*listen\s+[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:(80|443)\b' <<<"$config"; then
  falha "há site do nginx preso a um IP. Mande a saída de: nginx -T | grep -n listen"
fi
# "zz-": o nginx usa como site padrão o primeiro em ordem alfabética; este tem de
# ser o último, para não virar o padrão no lugar de outro sistema da VPS.
SITE=/etc/nginx/sites-available/zz-entende
LIGADO=/etc/nginx/sites-enabled/zz-entende
outros="$(for a in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
  if [ -f "$a" ] && [ "$a" != "$LIGADO" ]; then
    grep -lE "server_name[^;]*[[:space:]]${DOMINIO//./\.}[[:space:];]" "$a" || true
  fi
done)"
[ -z "$outros" ] || falha "$DOMINIO já é usado em: $outros"

passo "Pacotes que faltam"
pacotes=()
falta git && pacotes+=(git)
falta curl && pacotes+=(curl)
falta certbot && pacotes+=(certbot)
if [ ${#pacotes[@]} -gt 0 ]; then
  apt-get update -q
  apt-get install -y -q "${pacotes[@]}"
fi
if falta uv; then
  # O uv traz o Python 3.11; o Ubuntu 22.04 vem com o 3.10.
  curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin INSTALLER_NO_MODIFY_PATH=1 sh
fi

passo "Usuário de sistema 'entende' (o servidor não roda como root)"
id entende >/dev/null 2>&1 || useradd --system --home-dir "$PASTA" --shell /usr/sbin/nologin entende
mkdir -p "$PASTA"
chown entende:entende "$PASTA"
# 700: o banco tem os materiais e os hashes de senha; outro usuário da VPS não lê.
chmod 700 "$PASTA"

# cd /: a pasta de quem chamou (a do root) não abre para o usuário entende.
como_entende() { (cd / && runuser -u entende -- env HOME="$PASTA" UV_PYTHON_INSTALL_DIR="$PASTA/python" "$@"); }

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
  segredo="$(head -c 48 /dev/urandom | base64 -w0 | tr -d '/+=')"
  chave=""
  if [ -t 0 ]; then
    # -s: a chave não aparece na tela nem no histórico do terminal.
    read -rsp "Cole a chave da OpenAI e aperte Enter (não aparece na tela): " chave
    echo
  fi
  install -m 600 -o entende -g entende /dev/null "$ENV"
  cat > "$ENV" <<FIM
# Gerado por implantar/instalar.sh. Não versionar.
ENTENDE_SEGREDO_TOKEN=$segredo
# A interface fica no GitHub Pages e chama esta API de lá.
ENTENDE_ORIGENS=$PAGES
ENTENDE_PROVEDOR=openai
OPENAI_API_KEY=$chave
FIM
  unset chave segredo
fi

passo "Porta interna livre (só 127.0.0.1)"
if [ ! -f "$PASTA/porta.env" ]; then
  for porta in $(seq 8010 8099); do
    [ -z "$(ss -Htln "sport = :$porta")" ] && break
  done
  [ -z "$(ss -Htln "sport = :$porta")" ] || falha "nenhuma porta livre entre 8010 e 8099."
  echo "PORTA=$porta" > "$PASTA/porta.env"
fi
PORTA="$(sed -n 's/^PORTA=//p' "$PASTA/porta.env")"
echo "Porta $PORTA"

passo "Serviço do servidor (systemd)"
install -m 644 "$AQUI/entende.service" /etc/systemd/system/entende.service
systemctl daemon-reload
systemctl enable entende >/dev/null 2>&1
systemctl restart entende
for _ in $(seq 30); do
  curl -fsS "http://127.0.0.1:$PORTA/api/saude" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS "http://127.0.0.1:$PORTA/api/saude" >/dev/null || falha "o servidor não respondeu. Veja: journalctl -u entende -n 40"

passo "Site no nginx"
# IPv6 só se o nginx já escutar nele: abrir aqui faria deste o site padrão do
# IPv6 para os outros domínios da VPS.
ouve6() { [ -n "$(ss -H6tln "sport = :$1")" ]; }
escrever_site() { # $1: arquivo modelo
  local anterior=""
  [ -f "$SITE" ] && anterior="$(mktemp)" && cp "$SITE" "$anterior"
  sed -e "s|DOMINIO_AQUI|$DOMINIO|g" -e "s|PORTA_AQUI|$PORTA|g" -e "s|ACME_AQUI|$ACME|g" \
      -e "s|PAGES_AQUI|$PAGES|g" "$1" > "$SITE"
  ouve6 80 || sed -i '/listen \[::\]:80/d' "$SITE"
  ouve6 443 || sed -i '/listen \[::\]:443/d' "$SITE"
  ln -sfn "$SITE" "$LIGADO"
  if ! nginx -t; then
    if [ -n "$anterior" ]; then cp "$anterior" "$SITE"; else rm -f "$LIGADO"; fi
    falha "o nginx recusou o site novo, que foi desfeito. Os outros sites seguem como estavam."
  fi
  [ -z "$anterior" ] || rm -f "$anterior"
  systemctl reload nginx
}

mkdir -p "$ACME"
if [ ! -f "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]; then
  conta=()
  if ! compgen -G '/etc/letsencrypt/accounts/*/directory/*' >/dev/null; then
    [ -n "${EMAIL:-}" ] || falha "o certbot não tem conta nesta VPS. Rode de novo com EMAIL=seu@email na frente."
    conta=(--agree-tos -m "$EMAIL")
  fi
  escrever_site "$AQUI/nginx-http.conf"
  # certonly + webroot: o certbot não edita nenhum arquivo do nginx.
  certbot certonly --webroot -w "$ACME" -d "$DOMINIO" --non-interactive "${conta[@]}" \
    --deploy-hook "systemctl reload nginx"
fi
escrever_site "$AQUI/nginx-https.conf"

passo "Conferindo pelo endereço público"
curl -fsS --retry 5 --retry-delay 1 --retry-all-errors "https://$DOMINIO/api/saude" && echo

passo "Pronto: https://$DOMINIO"
if ! grep -q '^OPENAI_API_KEY=.\+' "$ENV"; then
  echo "Falta a chave da OpenAI: nano $ENV   e depois: systemctl restart entende"
fi
echo "Contas: cd $APP/servidor && runuser -u entende -- .venv/bin/python administrar.py --help"
