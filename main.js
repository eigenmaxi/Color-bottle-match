/* main.js - Enhanced Debugging Version
   Restores your perfect game flow, updates minting for Base mainnet
   Keeps detailed logging and error handling
*/

const ethersLib = window.ethers;
if (!ethersLib) console.warn('ethers not found - blockchain features will not work.');

const gameContainer = document.getElementById('game-container');
const startButton = document.getElementById('start-button');
const timerElement = document.getElementById('timer');
const messageElement = document.getElementById('message');
const scoreElement = document.getElementById('score');

let timeLeft = 30;
let score = 0;
let targetColor = '';
let gameInterval;
let bottles = [];

const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink'];

const CONTRACT_ADDRESS = "0xCd0F532029F42F21E18eA1164cF8848cF380B370"; // New contract on Base mainnet
const ABI = [
  "function mintScoreNFT(string memory imageUrl, uint256 score) public" // Updated to match new contract
];

// ------- GAME LOGIC -------
startButton.addEventListener('click', startGame);

function startGame() {
  score = 0;
  timeLeft = 30;
  scoreElement.textContent = `Score: ${score}`;
  messageElement.textContent = '';
  startButton.style.display = 'none';
  gameContainer.innerHTML = '';
  generateBottles();
  setTargetColor();
  gameInterval = setInterval(updateTimer, 1000);
}

function generateBottles() {
  bottles = [];
  gameContainer.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const bottle = document.createElement('div');
    bottle.className = 'bottle';
    const color = colors[Math.floor(Math.random() * colors.length)];
    bottle.style.backgroundColor = color;
    bottle.dataset.color = color;
    bottle.addEventListener('click', () => handleBottleClick(bottle));
    bottles.push(bottle);
    gameContainer.appendChild(bottle);
  }
}

function setTargetColor() {
  const visibleColors = [...new Set(bottles.map(b => b.dataset.color))];
  if (visibleColors.length === 0) return;
  let newColor;
  do {
    newColor = visibleColors[Math.floor(Math.random() * visibleColors.length)];
  } while (newColor === targetColor && visibleColors.length > 1);
  targetColor = newColor;
  messageElement.textContent = `🎯 Tap all ${targetColor.toUpperCase()} bottles!`;
}

function handleBottleClick(bottle) {
  if (bottle.dataset.color === targetColor) {
    score++;
    scoreElement.textContent = `Score: ${score}`;
    bottle.style.visibility = 'hidden';
  }
  const remaining = bottles.filter(b => b.dataset.color === targetColor && b.style.visibility !== 'hidden');
  if (remaining.length === 0) {
    generateBottles(); // Regenerate all bottles
    setTargetColor(); // Set new random target
  }
}

function updateTimer() {
  timeLeft--;
  timerElement.textContent = `Time: ${timeLeft}s`;
  if (timeLeft <= 0) {
    clearInterval(gameInterval);
    endGame();
  }
}

function endGame() {
  messageElement.textContent = '⏰ Game Over!';
  startButton.style.display = 'block';
  showEndScreen();
}

// ------- END SCREEN -------
async function showEndScreen() {
  gameContainer.innerHTML = '';

  // Create scorecard
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  // Gradient background
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, '#2b2d42');
  g.addColorStop(0.5, '#5a55a3');
  g.addColorStop(1, '#9b59b6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card panel
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(30, 100, canvas.width - 60, canvas.height - 240);

  // Bottle art
  ctx.fillStyle = '#ffffffcc';
  const bx = canvas.width / 2 - 80;
  ctx.beginPath();
  ctx.moveTo(bx, 180);
  ctx.lineTo(bx + 160, 180);
  ctx.lineTo(bx + 160, 500);
  ctx.lineTo(bx, 500);
  ctx.closePath();
  ctx.fill();

  // Cap
  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(bx + 30, 150, 100, 30);

  // Text
  ctx.fillStyle = 'white';
  ctx.font = '36px Fredoka One, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Bottle Match Scorecard', canvas.width / 2, 90);

  ctx.font = 'bold 48px Poppins, sans-serif';
  ctx.fillText(`Score: ${score}`, canvas.width / 2, 620);

  ctx.font = '22px Poppins, sans-serif';
  let compliment = 'Nice try!';
  if (score > 40) compliment = 'Legendary!';
  else if (score > 25) compliment = 'Amazing!';
  else if (score > 10) compliment = 'Good job!';
  ctx.fillText(compliment, canvas.width / 2, 660);

  const imageDataUrl = canvas.toDataURL('image/png');

  // Use actual Pinata upload for production
  const imageUrl = await uploadImage(imageDataUrl);

  const img = new Image();
  img.src = imageDataUrl; // Display base64 for UI
  img.className = 'score-img';

  const wrapper = document.createElement('div');
  wrapper.className = 'end-screen';
  wrapper.appendChild(img);

  // Buttons
  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group';

  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.textContent = '📤 Share Score to Farcaster';
  shareBtn.onclick = () => {
    const postText = `🍾 I just scored ${score} in Bottle Match Scorecard! Can you beat me?`;
    const farcasterUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(postText)}`;
    window.open(farcasterUrl, '_blank');
  };

  const mintBtn = document.createElement('button');
  mintBtn.className = 'mint-btn';
  mintBtn.textContent = '💎 Mint Scorecard on Base (Fees Apply)';
  mintBtn.onclick = async () => {
    try {
      if (!window.ethereum) {
        alert('Please install Rabby or MetaMask and try again.');
        return;
      }

      console.log('Requesting wallet accounts...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('Connected accounts:', accounts);

      console.log('Switching to Base Mainnet...');
      await switchToBaseMainnet();
      console.log('Network switched successfully');

      const provider = new ethersLib.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethersLib.Contract(CONTRACT_ADDRESS, ABI, signer);

      // Get current gas price
      const gasPrice = await provider.getGasPrice();
      console.log('Current gas price:', ethersLib.utils.formatUnits(gasPrice, 'gwei'), 'gwei');

      // Estimate gas for the transaction
      console.log('Estimating gas for mintScoreNFT...');
      const estimatedGas = await contract.estimateGas.mintScoreNFT(imageUrl, score);
      console.log('Estimated gas:', estimatedGas.toString());

      console.log('Minting NFT with image URL:', imageUrl, 'and score:', score);
      const tx = await contract.mintScoreNFT(imageUrl, score, {
        gasLimit: estimatedGas.mul(120).div(100), // Add 20% buffer
        gasPrice,
      });
      console.log('Transaction sent:', tx.hash);

      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt.transactionHash);

      alert('✅ NFT minted successfully on Base Mainnet!');
    } catch (err) {
      console.error('Mint failed:', err);
      if (err.code === 4001) {
        alert('Transaction rejected by user.');
      } else if (err.message.includes('out of gas') || err.message.includes('exceeds gas limit')) {
        alert('❌ Transaction failed: insufficient gas. Please try again with a higher gas limit.');
      } else if (err.message.includes('network')) {
        alert('❌ Network error. Please check your connection to Base Mainnet and try again.');
      } else {
        alert(`❌ Mint failed: ${err.message}. See console for details.`);
      }
    }
  };

  btnGroup.appendChild(shareBtn);
  btnGroup.appendChild(mintBtn);
  wrapper.appendChild(btnGroup);
  gameContainer.appendChild(wrapper);
}

// ------- HELPER: IMAGE UPLOAD -------
async function uploadImage(imageDataUrl) {
  const blob = await (await fetch(imageDataUrl)).blob();
  const formData = new FormData();
  formData.append('file', blob, 'scorecard.png');

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer YOUR_ACTUAL_PINATA_JWT`, // Replace with your Pinata JWT
    },
    body: formData,
  });

  const result = await response.json();
  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
}

// ------- HELPER: SWITCH NETWORK -------
async function switchToBaseMainnet() {
  const chainId = '0x2105'; // Base Mainnet
  try {
    console.log('Attempting to switch to chain ID:', chainId);
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (switchError) {
    console.error('Network switch failed:', switchError);
    if (switchError.code === 4902) {
      console.log('Adding Base Mainnet network...');
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId,
          chainName: 'Base Mainnet',
          rpcUrls: ['https://mainnet.base.org'],
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          blockExplorerUrls: ['https://basescan.org'],
        }],
      });
    } else {
      throw switchError;
    }
  }
}