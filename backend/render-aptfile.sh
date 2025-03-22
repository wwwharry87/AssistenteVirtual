#!/bin/bash
set -o errexit

if [[ -f aptfile ]]; then
  echo "Instalando dependências do sistema..."
  xargs -a aptfile apt-get install -y
fi