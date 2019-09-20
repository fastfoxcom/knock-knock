const { IncomingWebhook } = require('@slack/webhook');

const url = process.env.SLACK_WEBHOOK_URL;

module.exports = {
  sendSlackMessage: async ({messageTo, messageText}) => {
    const webhook = new IncomingWebhook(url, {
      icon_emoji: process.env.SLACK_ICON_EMOJI,
      username: process.env.SLACK_BOT_USERNAME,
      channel: messageTo
    });
    await webhook.send({text: messageText});
  }
}
