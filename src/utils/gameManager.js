const { recordGame }=require('./gameData');
const { getGamePoints }=require('./gamePoints');
const { sendAuditLog }=require('./auditLog');

async function finishGame({interaction,game,result,metadata=null}){
 const points=getGamePoints(game,result);
 const data=recordGame({userId:interaction.user.id,username:interaction.user.username,game,result,points,metadata});
 await sendAuditLog({
   guild:interaction.guild,type:'GAME',action:'PLAY',actor:interaction.user,target:interaction.user,
   channel:interaction.channel,reason:result,data:{game,result,points,...(metadata||{})}
 });
 return {points,data};
}
module.exports={finishGame};
