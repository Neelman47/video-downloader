#!/usr/bin/env bash
# StreamVault - Development Launcher for macOS & Linux
echo "==================================================="
echo "  Starting StreamVault in Development Mode"
echo "==================================================="
echo ""

# Ensure dependencies are installed
if [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
  echo "Installing dependencies..."
  npm install --prefix server
  npm install --prefix client
fi

node dev.js
