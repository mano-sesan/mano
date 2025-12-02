#!/bin/bash -e

ip_address=$(ipconfig getifaddr en0 || true)

if [[ $ip_address =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Adresse IP valide : $ip_address"
  sed -i '' -e "s/[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}/$ip_address/g" .env
else
  echo "Erreur : l'adresse IP obtenue n'est pas valide ou est vide."
fi
