
const fmtAmt = (v) => (Math.trunc(v * 10000) / 10000).toFixed(4);

console.log('0.5 ->', fmtAmt(0.5));
console.log('0.25 ->', fmtAmt(0.25));
console.log('2.0 ->', fmtAmt(2.0));
console.log('1.0 ->', fmtAmt(1.0));
