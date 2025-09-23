#!/bin/bash
set -e

echo "🚀 Deploying scarabeo-ace-44 to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Please login to Railway first:"
    echo "railway login"
    exit 1
fi

echo "✅ Railway CLI is ready"

# Deploy backend first
echo "📦 Deploying backend (service-quackle)..."
cd service-quackle

# Create Railway project for backend if it doesn't exist
if ! railway status &> /dev/null; then
    echo "Creating new Railway project for backend..."
    railway project new --name "service-quackle"
fi

# Set environment variables for backend
echo "Setting backend environment variables..."
railway variables set CORS_ORIGINS="https://scarabeo-ace-44.lovable.app,https://preview--scarabeo-ace-44.lovable.app,https://scarabeo-ace-44-production.up.railway.app"
railway variables set DAWG_URL="https://raw.githubusercontent.com/Jacopo888/scarabeo-ace-44/main/docs/data/lexica/enable1.dawg"
railway variables set GADDAG_URL="https://raw.githubusercontent.com/Jacopo888/scarabeo-ace-44/main/docs/data/lexica/enable1.gaddag"
railway variables set QUACKLE_APPDATA_DIR="/data/appdata"
railway variables set QUACKLE_LEXDIR="/data/lexica"
railway variables set QUACKLE_LEXICON="enable1"

# Deploy backend
echo "Deploying backend..."
railway up --detach

# Get backend URL
echo "Getting backend URL..."
BACKEND_URL=$(railway domain)
echo "Backend URL: $BACKEND_URL"

# Go back to root directory
cd ..

# Deploy frontend
echo "📦 Deploying frontend..."
if ! railway status &> /dev/null; then
    echo "Creating new Railway project for frontend..."
    railway project new --name "scarabeo-ace-44"
fi

# Set environment variables for frontend
echo "Setting frontend environment variables..."
railway variables set VITE_QUACKLE_SERVICE_URL="https://$BACKEND_URL"

# Deploy frontend
echo "Deploying frontend..."
railway up --detach

# Get frontend URL
echo "Getting frontend URL..."
FRONTEND_URL=$(railway domain)
echo "Frontend URL: $FRONTEND_URL"

echo "🎉 Deployment completed!"
echo "Backend: https://$BACKEND_URL"
echo "Frontend: https://$FRONTEND_URL"
echo ""
echo "Next steps:"
echo "1. Test backend health: curl https://$BACKEND_URL/health"
echo "2. Test frontend: Open https://$FRONTEND_URL in browser"
echo "3. Test VS Quackle feature in the frontend"
