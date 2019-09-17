const { IncomingWebhook } = require('@slack/webhook');

const url = process.env.SLACK_WEBHOOK_URL;

// Initialize with defaults
const webhook = new IncomingWebhook(url, {
  icon_emoji: ':bowtie:',
  username: 'phabreminder',
  channel: "@mohit"
});

module.exports = {
  sendSlackMessage: async ({messageText}) => {
    await webhook.send({text: messageText});
  }
}
