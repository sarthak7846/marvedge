#!/bin/bash
# Setup script for TalkNet-ASD on a GPU Box
set -e

echo "Starting TalkNet-ASD setup..."

# 1. Ensure Python 3 and pip are installed
if ! command -v python3 &> /dev/null; then
    echo "Python3 could not be found. Please install Python3 (preferably >= 3.8)."
    exit 1
fi

# 2. Clone the repository
if [ -d "TalkNet-ASD" ]; then
    echo "TalkNet-ASD directory already exists, skipping clone."
else
    echo "Cloning TalkNet-ASD..."
    git clone https://github.com/TaoRuijie/TalkNet-ASD.git
fi

cd TalkNet-ASD

# 3. Create a virtual environment (recommended)
echo "Creating python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# 4. Install dependencies
echo "Installing pip dependencies..."
pip install --upgrade pip

# Install PyTorch with CUDA support. This command might vary based on your specific CUDA version (e.g. 11.8 or 12.1)
# For this script we assume a standard recent PyTorch wheel with CUDA support is fine.
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install other requirements listed by TalkNet
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    echo "requirements.txt not found, installing commonly known dependencies..."
    pip install scipy numpy librosa opencv-python python_speech_features tqdm
fi

echo "TalkNet-ASD setup complete!"
echo "To run TalkNet-ASD, ensure you have a video file and use:"
echo "source venv/bin/activate"
echo "python demoTalkNet.py --videoName <your_video.mp4>"
