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
    const selfMention = `<@!${client.user?.id}>`
    let content = message.content.startsWith(selfMention)
      ? message.content.replace(selfMention, '').trim()
      : message.content

    for (const spirit of spirits) {
      try {
        //////////////////
        /* Alias Spirit */
        //////////////////
        if (spirit.type === 'alias') {
          if (content.startsWith(spirit.alias)) {
            content = content.replace(spirit.alias, spirit.expansion).trim()
            // By design, aliases can only expand to lower-priority Spirits, simply by `continue`ing
            continue
          }
        }

        //////////////////
        /* React Spirit */
        //////////////////
        if (spirit.type === 'react') {
          const [trigger, flags] = spirit.trigger.slice(1).split('/')
          const regex = new RegExp(trigger, flags)

          if (content.match(regex)) {
            const { body: result } = await got.post(spirit.endpoint, {
              // The Message class serializes rather neatly, but we need to override that content
              json: { ...(message.toJSON() as object), content },
              responseType: 'text',
            })
            const reactions = [...result.trim()]
            reactions.forEach((emoji) => message.react(emoji))
            break
          }
        }

        //////////////////
        /* Reply Spirit */
        //////////////////
        if (spirit.type === 'reply') {
          const [trigger, flags] = spirit.trigger.slice(1).split('/')
          const regex = new RegExp(trigger, flags)

          if (content.match(regex)) {
            message.channel.sendTyping()
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
              allowedMentions: { repliedUser: false },
            })
            break
          }
        }
      } catch (e) {
        console.error(`A spirit failed with ${e}`)
        message.reply({
          content: 'A spirit could not respond...',
          allowedMentions: { repliedUser: false, parse: [] },
        })
      }
    }
  } catch (e) {
    console.error(e)
  }
})

client.login(process.env.DISCORD_TOKEN)
