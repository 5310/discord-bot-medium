import { Client, GuildChannel, Intents, Permissions } from 'discord.js'
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

  const botPermissions = message.guild?.me?.permissionsIn(
    message.channel as GuildChannel,
  )
  const canReply = botPermissions?.has(Permissions.FLAGS.SEND_MESSAGES) ?? true
  const canReact = botPermissions?.has(Permissions.FLAGS.ADD_REACTIONS) ?? true

  const spirits =
    (
      await jsonfile.readFile(`store/${message.guildId}.json`, {
        throws: false,
      })
    )?.spirits ?? []

  try {
    const selfMention = `<@!${client.user?.id}>`
    const direct = message.content.startsWith(selfMention)
    let content = direct
      ? message.content.replace(selfMention, '').trim()
      : message.content

    for (const spirit of spirits) {
      if (spirit.direct && !direct) continue
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
        if (spirit.type === 'react' && canReply) {
          const [trigger, flags] = spirit.trigger.slice(1).split('/')
          const regex = new RegExp(trigger, flags)
          const match = content.match(regex)

          if (match?.groups?.command)
            content = content.replace(match.groups.command, '').trim()

          if (match) {
            const { body: result } = await got.post(spirit.endpoint, {
              json: {
                ...(message.toJSON() as Record<string, unknown>),
                content,
              },
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
        if (spirit.type === 'reply' && canReact) {
          const [trigger, flags] = spirit.trigger.slice(1).split('/')
          const regex = new RegExp(trigger, flags)
          const match = content.match(regex)

          if (match?.groups?.command)
            content = content.replace(match.groups.command, '').trim()

          if (match) {
            message.channel.sendTyping()
            // For some reason, the `send()` won't accept `MessageOptions`, but would accept `ReplyMessageOptions`
            const { body: reply }: { body: Record<string, unknown> } =
              await got.post(spirit.endpoint, {
                // The Message class serializes rather neatly, but we need to override that content
                json: {
                  ...(message.toJSON() as Record<string, unknown>),
                  content,
                },
                responseType: 'json',
              })
            // Decided against replying if the spirit is slient. If it's silent, it's silent!
            message.reply({
              ...reply,
              allowedMentions: { repliedUser: false },
            })
            break
          }
        }
      } catch (e) {
        console.error(`A spirit failed with ${e}`, { spirit, content })
        // Debug:
        // message.reply({
        //   content: 'Some Spirits could not respond...',
        //   allowedMentions: { repliedUser: false, parse: [] },
        // })
      }
    }
  } catch (e) {
    console.error(e)
  }
})

client.login(process.env.DISCORD_TOKEN)
