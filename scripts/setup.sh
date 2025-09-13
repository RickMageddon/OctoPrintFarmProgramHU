#!/bin/bash

# HU OctoPrint Farm Setup Script
# This script helps with the initial setup of the OctoPrint Farm

set -e

echo "🚀 HU OctoPrint Farm Setup"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ]; then
    print_warning "This doesn't appear to be a Raspberry Pi. Some features may not work correctly."
fi

# Check for required commands
print_status "Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Run: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    echo "Run: sudo pip3 install docker-compose"
    exit 1
fi

print_status "Prerequisites check passed!"

# Check if .env file exists
if [ ! -f .env ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_warning "Please edit .env file with your configuration before continuing."
    print_warning "You need to set up:"
    echo "  - GitHub OAuth credentials"
    echo "  - Email SMTP settings"
    echo "  - Session secret"
    echo ""
    read -p "Press Enter when you have configured .env file..."
fi

# Check USB devices
print_status "Checking USB devices for printers..."
if [ -e /dev/ttyUSB0 ]; then
    print_status "Found /dev/ttyUSB0"
else
    print_warning "No /dev/ttyUSB0 found - make sure printer 1 is connected"
fi

if [ -e /dev/ttyUSB1 ]; then
    print_status "Found /dev/ttyUSB1"
else
    print_warning "No /dev/ttyUSB1 found - make sure printer 2 is connected"
fi

if [ -e /dev/ttyUSB2 ]; then
    print_status "Found /dev/ttyUSB2"
else
    print_warning "No /dev/ttyUSB2 found - make sure printer 3 is connected"
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p database
mkdir -p uploads
chmod 755 database uploads

# Set proper permissions for USB devices (if they exist)
if [ -e /dev/ttyUSB0 ] || [ -e /dev/ttyUSB1 ] || [ -e /dev/ttyUSB2 ]; then
    print_status "Setting USB device permissions..."
    sudo usermod -a -G dialout $USER
    print_warning "You may need to logout and login again for USB permissions to take effect."
fi

# Pull Docker images
print_status "Pulling Docker images..."
docker-compose pull

# Build custom images
print_status "Building application images..."
docker-compose build

# Start services
print_status "Starting services..."
docker-compose up -d

# Wait for services to start
print_status "Waiting for services to start..."
sleep 30

# Check service health
print_status "Checking service health..."

# Check backend
if curl -f http://localhost:3001/health &> /dev/null; then
    print_status "Backend is healthy"
else
    print_error "Backend health check failed"
fi

# Check frontend
if curl -f http://localhost:3000 &> /dev/null; then
    print_status "Frontend is accessible"
else
    print_error "Frontend health check failed"
fi

# Check OctoPrint instances
for i in {1..3}; do
    port=$((5000 + i))
    if curl -f http://localhost:$port &> /dev/null; then
        print_status "OctoPrint $i is accessible on port $port"
    else
        print_warning "OctoPrint $i health check failed on port $port"
    fi
done

echo ""
print_status "Setup completed!"
echo ""
echo "🌐 Access URLs:"
echo "  Frontend:    http://$(hostname -I | awk '{print $1}'):3000"
echo "  Backend:     http://$(hostname -I | awk '{print $1}'):3001"
echo "  OctoPrint 1: http://$(hostname -I | awk '{print $1}'):5001"
echo "  OctoPrint 2: http://$(hostname -I | awk '{print $1}'):5002"
echo "  OctoPrint 3: http://$(hostname -I | awk '{print $1}'):5003"
echo ""
echo "📋 Next steps:"
echo "1. Configure each OctoPrint instance:"
echo "   - Complete the setup wizard"
echo "   - Generate API keys"
echo "   - Configure printer connections"
echo ""
echo "2. Update .env file with OctoPrint API keys"
echo ""
echo "3. Restart backend: docker-compose restart backend"
echo ""
echo "4. Test the application by logging in with GitHub"
echo ""
print_status "Happy printing! 🎉"
