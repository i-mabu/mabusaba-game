function draw(){ return Math.floor(Math.random()*11)+1; }
function handTotal(hand){
  let total=hand.reduce((a,b)=>a+b,0);
  let aces=hand.filter(v=>v===11).length;
  while(total>21&&aces>0){ total-=10; aces--; }
  return total;
}
function start(){
 const player=[draw(),draw()], dealer=[draw(),draw()];
 return {player,dealer,total:handTotal(player),dealerTotal:handTotal(dealer)};
}
function hit(state){
 state.player.push(draw());
 state.total=handTotal(state.player);
 return state;
}
function dealerPlay(state){
 while(handTotal(state.dealer)<17) state.dealer.push(draw());
 state.dealerTotal=handTotal(state.dealer);
 return state;
}
function result(state){
 if(state.total>21)return 'lose';
 dealerPlay(state);
 if(state.dealerTotal>21)return 'win';
 if(state.total>state.dealerTotal)return 'win';
 if(state.total<state.dealerTotal)return 'lose';
 return 'draw';
}
module.exports={start,hit,dealerPlay,result,handTotal};
