const RED=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function spin(){const n=Math.floor(Math.random()*37); return {number:n,color:n===0?'green':RED.has(n)?'red':'black'};}
module.exports={spin};
