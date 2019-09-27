const { IncomingWebhook } = require('@slack/webhook');

const { env: { SLACK_WEBHOOK_URL } } = process;

module.exports = {
  sendSlackMessage: async ({ messageTo, messageText }) => {
    const webhook = new IncomingWebhook(SLACK_WEBHOOK_URL, {
      icon_emoji: process.env.SLACK_ICON_EMOJI,
      username: process.env.SLACK_BOT_USERNAME,
      channel: messageTo,
    });
    await webhook.send({ text: messageText });
  },
};
