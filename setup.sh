#!/bin/bash
echo "Setting up Voice to Text..."
cd apps/electron && npm install && npx tsc && node scripts/copy-assets.js && cd ../..
cd apps/desktop && npm install && cd ../..
echo "Done! Run 'cd apps/electron && npm run dev' for desktop app"
echo "Or run 'cd apps/desktop && npx next dev' for web app"
