@echo off
echo Setting Identity...
git config user.email "aifusionlabs@gmail.com"
git config user.name "AI Fusion Labs"

echo Adding Files...
git add .

echo Committing...
git commit -m "Initial commit Sarah Netic v1.0"

echo Configuring Remote...
git branch -M main
git remote remove origin
git remote add origin https://github.com/aifusionlabs25/netic-sarah-app.git

echo Pushing...
git push -u origin main
