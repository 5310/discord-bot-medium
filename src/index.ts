import { Client, HTTPError, Intents } from 'discord.js'
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

      if (prompt.match(regex)) {
        message.channel.sendTyping()
        try {
          const { body: reply } = await got.post(specter.endpoint, {
            json: {
              prompt,
              regex: specter.regex,
            },
          })
          message.channel.send(reply ?? 'The Specter is silent...')
          break
        } catch (e) {
          console.error(`The Specter failed with ${e}`)
          message.channel.send('The Specter could not respond...')
          continue
        }
      }
    }
  } catch (e) {
    console.error(e)
  }
})

client.login(process.env.DISCORD_TOKEN)
