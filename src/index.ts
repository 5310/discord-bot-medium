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

  const { guildId, content: prompt } = message

  const specters =
    (await jsonfile.readFile(`db/${guildId}.json`, {
      throws: false,
    })) ?? []

  try {
    for (const specter of specters) {
      const [pattern, flags] = specter.regex.slice(1).split('/')
      const regex = new RegExp(pattern, flags)

      const content = message.content.startsWith(`<@!${client.user?.id}>`)
        ? message.content.slice((client.user?.id.length ?? 0) + 4).trim()
        : message.content

      if (content.match(regex)) {
        message.channel.sendTyping()
        try {
          // For some reason, the `send()` won't accept `MessageOptions`, but would accept `ReplyMessageOptions`
          const { body: reply }: { body: object } = await got.post(
            specter.endpoint,
            {
              // The Message class serializes rather neatly, but we need to override that content
              json: { ...(message.toJSON() as object), content },
              responseType: 'json',
            },
          )
          // Note: Decided against replying if the Specter. If it's silent, it's silent!
          message.reply({
            ...reply,
            allowedMentions: { repliedUser: false, parse: [] },
          })
          break
        } catch (e) {
          console.error(`The Specter failed with ${e}`)
          message.reply({
            content: 'The Specter could not respond...',
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
