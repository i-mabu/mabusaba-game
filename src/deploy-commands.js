require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN が設定されていません。');
  process.exit(1);
}

if (!CLIENT_ID) {
  console.error('❌ CLIENT_ID が設定されていません。');
  process.exit(1);
}

if (!GUILD_ID) {
  console.error('❌ GUILD_ID が設定されていません。');
  process.exit(1);
}

const commandsPath = path.join(__dirname, 'commands');
const commands = [];

for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
  try {
    const command = require(path.join(commandsPath, file));

    if (!command.data || typeof command.data.toJSON !== 'function') {
      console.warn(`⚠️ コマンド形式不正: ${file}`);
      continue;
    }

    if (typeof command.execute !== 'function') {
      console.warn(`⚠️ execute未定義: ${file}`);
      continue;
    }

    commands.push(command.data.toJSON());
    console.log(`✅ コマンド読み込み: ${command.data.name}`);
  } catch (error) {
    console.error(`❌ コマンド読み込み失敗: ${file}`);
    console.error(error);
    process.exitCode = 1;
  }
}

if (process.exitCode) process.exit(1);

(async () => {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);

    console.log('=================================');
    console.log('📦 Discord Slash Command 登録開始');
    console.log(`🤖 Client ID: ${CLIENT_ID}`);
    console.log(`🏠 Guild ID: ${GUILD_ID}`);
    console.log(`📦 コマンド数: ${commands.length}`);
    console.log('=================================');

    const result = await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log(`✅ ${result.length}個のコマンドをギルドへ登録しました。`);
    console.log('💡 Discordを再起動/再読み込みして確認してください。');
  } catch (error) {
    console.error('❌ Slash Command登録に失敗しました。');
    console.error(error?.rawError ?? error);
    process.exit(1);
  }
})();
