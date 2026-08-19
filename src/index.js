require('dotenv').config();
require('./utils/database').migrateDatabase();

const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  MessageFlags,
} = require('discord.js');

const fs = require('fs');
const path = require('path');

/*
 * =========================================================
 * Client
 * =========================================================
 */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
  ],
});

/*
 * =========================================================
 * Commands
 * =========================================================
 */

client.commands = new Collection();

const commandsPath = path.join(
  __dirname,
  'commands'
);

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const filePath = path.join(
        commandsPath,
        file
      );

      const command = require(filePath);

      if (!command.data || !command.execute) {
        console.warn(
          `[WARNING] ${file} に data または execute がありません。`
        );
        continue;
      }

      client.commands.set(
        command.data.name,
        command
      );

      console.log(
        `✅ コマンド読み込み: ${command.data.name}`
      );
    } catch (error) {
      console.error(
        `❌ コマンド読み込み失敗: ${file}`,
        error
      );
    }
  }
}

/*
 * =========================================================
 * Events
 * =========================================================
 */

const eventsPath = path.join(
  __dirname,
  'events'
);

if (fs.existsSync(eventsPath)) {
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    try {
      const filePath = path.join(
        eventsPath,
        file
      );

      const event = require(filePath);

      if (!event.name || !event.execute) {
        console.warn(
          `[WARNING] ${file} に name または execute がありません。`
        );
        continue;
      }

      if (event.once) {
        client.once(
          event.name,
          (...args) =>
            event.execute(
              ...args,
              client
            )
        );
      } else {
        client.on(
          event.name,
          (...args) =>
            event.execute(
              ...args,
              client
            )
        );
      }

      console.log(
        `✅ イベント読み込み: ${event.name}`
      );
    } catch (error) {
      console.error(
        `❌ イベント読み込み失敗: ${file}`,
        error
      );
    }
  }
}

/*
 * =========================================================
 * Interaction Handler
 * =========================================================
 */

client.on(
  Events.InteractionCreate,
  async interaction => {
    /*
     * =======================================================
     * Slash Command
     * =======================================================
     */

    if (interaction.isChatInputCommand()) {
      const command =
        client.commands.get(
          interaction.commandName
        );

      if (!command) {
        console.warn(
          `コマンド「${interaction.commandName}」が見つかりません。`
        );
        return;
      }

      try {
        await command.execute(
          interaction,
          client
        );
      } catch (error) {
        console.error(
          `コマンド「${interaction.commandName}」の実行中にエラーが発生しました:`,
          error
        );

        await safeInteractionError(
          interaction,
          '❌ コマンドの実行中にエラーが発生しました。'
        );
      }

      return;
    }

    /*
     * =======================================================
     * Modal
     * =======================================================
     */

    if (interaction.isModalSubmit()) {
      for (
        const command
        of client.commands.values()
      ) {
        if (
          typeof command.handleModal !==
          'function'
        ) {
          continue;
        }

        try {
          const handled =
            await command.handleModal(
              interaction,
              client
            );

          if (handled) {
            return;
          }
        } catch (error) {
          console.error(
            '❌ Modal処理エラー:',
            error
          );

          await safeInteractionError(
            interaction,
            `❌ 入力処理中にエラーが発生しました。\n\`${error.message}\``
          );

          return;
        }
      }

      return;
    }

    /*
     * =======================================================
     * Button
     * =======================================================
     */

    if (interaction.isButton()) {
      for (
        const command
        of client.commands.values()
      ) {
        if (
          typeof command.handleButton !==
          'function'
        ) {
          continue;
        }

        try {
          const handled =
            await command.handleButton(
              interaction,
              client
            );

          if (handled) {
            return;
          }
        } catch (error) {
          console.error(
            '❌ Button処理エラー:',
            error
          );

          await safeInteractionError(
            interaction,
            `❌ ボタン処理中にエラーが発生しました。\n\`${error.message}\``
          );

          return;
        }
      }
    }

    /*
     * =======================================================
     * String Select
     * =======================================================
     */

    if (
      interaction.isStringSelectMenu()
    ) {
      for (
        const command
        of client.commands.values()
      ) {
        if (
          typeof command.handleSelectMenu !==
          'function'
        ) {
          continue;
        }

        try {
          const handled =
            await command.handleSelectMenu(
              interaction,
              client
            );

          if (handled) {
            return;
          }
        } catch (error) {
          console.error(
            '❌ SelectMenu処理エラー:',
            error
          );

          await safeInteractionError(
            interaction,
            `❌ メニュー処理中にエラーが発生しました。\n\`${error.message}\``
          );

          return;
        }
      }
    }
  }
);

/*
 * =========================================================
 * Safe Interaction Error
 * =========================================================
 */

async function safeInteractionError(
  interaction,
  content
) {
  try {
    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.followUp({
        content,
        flags:
          MessageFlags.Ephemeral,
      });

      return;
    }

    await interaction.reply({
      content,
      flags:
        MessageFlags.Ephemeral,
    });
  } catch (error) {
    console.error(
      '❌ Interaction error response failed:',
      error
    );
  }
}

/*
 * =========================================================
 * Discord Errors
 * =========================================================
 */

client.on(
  Events.Error,
  error => {
    console.error(
      'Discord Client Error:',
      error
    );
  }
);

client.on(
  Events.Warn,
  warning => {
    console.warn(
      'Discord Warning:',
      warning
    );
  }
);

/*
 * =========================================================
 * Process Errors
 * =========================================================
 */

process.on(
  'unhandledRejection',
  error => {
    console.error(
      'Unhandled Promise Rejection:',
      error
    );
  }
);

process.on(
  'uncaughtException',
  error => {
    console.error(
      'Uncaught Exception:',
      error
    );
  }
);

/*
 * =========================================================
 * Login
 * =========================================================
 */

if (!process.env.DISCORD_TOKEN) {
  console.error(
    '❌ DISCORD_TOKEN が環境変数に設定されていません。'
  );

  process.exit(1);
}

const { getAuditLogChannelId } = require('./utils/auditLog');

const auditLogChannelId = getAuditLogChannelId();
if (auditLogChannelId) {
  console.log(`📜 監査ログ送信先: ${auditLogChannelId}`);
} else {
  console.warn('⚠️ 監査ログ送信先が未設定です。AUDIT_LOG_CHANNEL_ID / MOD_LOG_CHANNEL_ID / LOG_CHANNEL_ID のいずれかを .env に設定してください。');
}

client.login(
  process.env.DISCORD_TOKEN
);