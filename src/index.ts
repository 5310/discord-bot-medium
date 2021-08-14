import { MessageOptions } from 'child_process'
import { Client, HTTPError, Intents, ReplyMessageOptions } from 'discord.js'
import got from 'got'
import jsonfile from 'jsonfile'

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
})

client.once('ready', () => {
  console.log('Séance in progress...')
})

client.on('messageCreate', async (message) => {
  if (message.author.bot) return

  const { guildId } = message

  const spirits =
    (await jsonfile.readFile(`db/${guildId}.json`, {
      throws: false,
    })) ?? []

  try {
    for (const spirit of spirits) {
      const [pattern, flags] = spirit.trigger.slice(1).split('/')
      const trigger = new RegExp(pattern, flags)

      const content = message.content.startsWith(`<@!${client.user?.id}>`)
        ? message.content.slice((client.user?.id.length ?? 0) + 4).trim()
        : message.content

      if (content.match(trigger)) {
        message.channel.sendTyping()
        try {
          // For some reason, the `send()` won't accept `MessageOptions`, but would accept `ReplyMessageOptions`
          const { body: reply }: { body: object } = await got.post(
            spirit.endpoint,
            {
              // The Message class serializes rather neatly, but we need to override that content
              json: { ...(message.toJSON() as object), content },
              responseType: 'json',
            },
          )
          // Decided against replying if the spirit is slient. If it's silent, it's silent!
          message.reply({
            ...reply,
            allowedMentions: { repliedUser: false, parse: [] },
          })
          break
        } catch (e) {
          console.error(`The spirit failed with ${e}`)
          message.reply({
            content: 'The spirit could not respond...',
            allowedMentions: { repliedUser: false, parse: [] },
          })
          continue
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
})

client.login(process.env.DISCORD_TOKEN)
