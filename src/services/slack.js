const { IncomingWebhook } = require('@slack/webhook');

const url = process.env.SLACK_WEBHOOK_URL;

// Initialize with defaults
const webhook = new IncomingWebhook(url, {
  icon_emoji: process.env.SLACK_ICON_EMOJI,
  username: process.env.SLACK_BOT_USERNAME,
  channel: process.env.SLACK_CHANNEL
});

module.exports = {
  sendSlackMessage: async ({messageText}) => {
    await webhook.send({text: messageText});
  }
}
