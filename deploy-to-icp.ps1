# Deploy to ICP Script
Write-Host "Starting deployment to Internet Computer Protocol..." -ForegroundColor Green

# Step 1: Check if DFX is installed
Write-Host "Checking DFX installation..." -ForegroundColor Yellow
try {
    $dfxVersion = dfx --version
    Write-Host "DFX is installed: $dfxVersion" -ForegroundColor Green
} catch {
    Write-Host "DFX not found. Installing DFX..." -ForegroundColor Red
    # Download and install DFX
    Invoke-WebRequest -Uri "https://internetcomputer.org/install.sh" -OutFile "install.sh"
    bash install.sh
    Write-Host "DFX installed successfully!" -ForegroundColor Green
}

# Step 2: Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

# Step 3: Build the project
Write-Host "Building the project..." -ForegroundColor Yellow
npm run build

# Step 4: Start DFX (local)
Write-Host "Starting DFX..." -ForegroundColor Yellow
dfx start --background

# Step 5: Create identity if needed
Write-Host "Setting up identity..." -ForegroundColor Yellow
try {
    dfx identity get-principal
} catch {
    dfx identity new default
    dfx identity use default
}

# Step 6: Deploy to IC mainnet
Write-Host "Deploying to IC mainnet..." -ForegroundColor Yellow
dfx deploy --network ic

# Step 7: Get the live URL
Write-Host "Getting your live URL..." -ForegroundColor Yellow
$canisterId = dfx canister id agriq_frontend --network ic
$liveUrl = "https://$canisterId.ic0.app"

Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Your live URL is: $liveUrl" -ForegroundColor Cyan
Write-Host "Backend canister: $(dfx canister id passport_registry --network ic)" -ForegroundColor Cyan

# Copy URL to clipboard
$liveUrl | Set-Clipboard
Write-Host "URL has been copied to your clipboard!" -ForegroundColor Green
