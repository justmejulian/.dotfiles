#! /bin/bash
kitten @ launch --type=tab --tab-title "Tunnel Name" --keep-focus sh -c 'ssh -L localhost:5432:0.0.0.0:5432 hostname'

echo "Waiting for tunnel to be ready..."
sleep 5

kitten @ set-tab-title "Name DB" 
dblab --config --cfg-name "config-name"
