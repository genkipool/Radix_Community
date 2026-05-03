
const fs = require('fs');
const content = fs.readFileSync('features/dashboard/explorador/components/SwapSettlementCard.tsx', 'utf8');

let depth = 0;
const lines = content.split('\n');
lines.forEach((line, i) => {
    // Count openings that are NOT self-closing
    const opens = (line.match(/<div(?![^>]*\/>)/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    depth += opens - closes;
    if (opens > 0 || closes > 0) {
        console.log(`${String(i + 1).padStart(3)}: Depth ${depth.toString().padStart(2)} | ${line.trim()}`);
    }
});
console.log('Final Depth:', depth);
