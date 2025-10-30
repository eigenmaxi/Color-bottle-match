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

const CONTRACT_ADDRESS = "0xCd0F532029F42F21E18eA1164cF8848cF380B370"; // Base mainnet contract
const ABI = [
  "function mintScoreNFT(string memory imageUrl, uint256 score) public"
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
    generateBottles();
    setTargetColor();
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

  const loading = document.createElement('div');
  loading.textContent = 'Generating scorecard...';
  loading.style.padding = '20px';
  loading.style.background = '#f0f0f0';
  loading.style.borderRadius = '10px';
  loading.style.margin = '20px 0';
  gameContainer.appendChild(loading);

  let imageUrl = '';
  let imageDataUrl = '';
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');

    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, '#2b2d42');
    g.addColorStop(0.5, '#5a55a3');
    g.addColorStop(1, '#9b59b6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(30, 100, canvas.width - 60, canvas.height - 240);

    ctx.fillStyle = '#ffffffcc';
    const bx = canvas.width / 2 - 80;
    ctx.beginPath();
    ctx.moveTo(bx, 180);
    ctx.lineTo(bx + 160, 180);
    ctx.lineTo(bx + 160, 500);
    ctx.lineTo(bx, 500);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#2b2d42';
    ctx.fillRect(bx + 30, 150, 100, 30);

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

    imageDataUrl = canvas.toDataURL('image/png');
    imageUrl = await uploadImage(imageDataUrl);
  } catch (err) {
    console.error('Scorecard generation failed:', err);
    imageUrl = imageDataUrl;  // Fallback
  } finally {
    gameContainer.removeChild(loading);
  }

  const img = new Image();
  img.src = imageUrl;
  img.className = 'score-img';

  const wrapper = document.createElement('div');
  wrapper.className = 'end-screen';
  wrapper.appendChild(img);

  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group';

  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.textContent = '📤 Share Score to Farcaster';
  shareBtn.onclick = async () => {
    try {
      await sdk.actions.composeCast({
        text: `🍾 I just scored ${score} in Bottle Match Scorecard! Can you beat me?`,
        embeds: [imageUrl],
        channelKey: 'farcaster'
      });
    } catch (err) {
      console.error('Share failed:', err);
      alert('Share failed - check connection or try in Farcaster app.');
    }
  };

  const mintBtn = document.createElement('button');
  mintBtn.className = 'mint-btn';
  mintBtn.textContent = '💎 Mint Scorecard on Base (Fees Apply)';
  mintBtn.onclick = async () => {
    try {
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) throw new Error('No wallet');
      await provider.request({ method: 'eth_requestAccounts' });
      const signer = new ethersLib.providers.Web3Provider(provider).getSigner();
      const contract = new ethersLib.Contract(CONTRACT_ADDRESS, ABI, signer);

      const gasPrice = await signer.getGasPrice();
      const estimatedGas = await contract.estimateGas.mintScoreNFT(imageUrl, score);

      const tx = await contract.mintScoreNFT(imageUrl, score, {
        gasLimit: estimatedGas.mul(120).div(100),
        gasPrice
      });
      await tx.wait();
      alert('✅ NFT minted!');
    } catch (err) {
      console.error('Mint failed:', err);
      alert(`❌ Mint failed: ${err.message}`);
    }
  };

  btnGroup.appendChild(shareBtn);
  btnGroup.appendChild(mintBtn);
  wrapper.appendChild(btnGroup);
  gameContainer.appendChild(wrapper);
}

// ------- IMAGE UPLOAD -------
async function uploadImage(imageDataUrl) {
  const blob = await (await fetch(imageDataUrl)).blob();
  const formData = new FormData();
  formData.append('file', blob, 'scorecard.png');

  const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: {
      Authorization: `Bearer YOUR_ACTUAL_PINATA_JWT`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) throw new Error('Upload failed');
  return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
}

// ------- FARCASTER MINI APP READY FIX -------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.sdk && window.sdk.actions && typeof window.sdk.actions.ready === "function") {
      await window.sdk.actions.ready();
      console.log("✅ Farcaster Mini App Ready via SDK!");
    } else if (window.frame && window.frame.actions && typeof window.frame.actions.ready === "function") {
      await window.frame.actions.ready();
      console.log("✅ Farcaster Mini App Ready via Frame!");
    } else {
      console.log("⚠️ Farcaster SDK not detected.");
    }
  } catch (err) {
    console.error("Farcaster ready() error:", err);
  }
});