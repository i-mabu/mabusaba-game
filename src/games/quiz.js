const QUESTIONS=[
 {q:'JavaScriptで配列の要素数を取得するプロパティは？',a:['size','length','count','items'],correct:1},
 {q:'Discord BotのNode.jsでよく使われるライブラリは？',a:['discord.js','react.js','express.css','numpy.js'],correct:0},
 {q:'HTTPのステータスコード404の意味は？',a:['成功','権限なし','見つからない','サーバーエラー'],correct:2},
 {q:'2進数の「1010」は10進数で？',a:['8','10','12','14'],correct:1},
 {q:'SQLiteのデータベースファイル拡張子として一般的なのは？',a:['.db','.exe','.html','.css'],correct:0},
];
function random(){return QUESTIONS[Math.floor(Math.random()*QUESTIONS.length)];}
module.exports={random};
