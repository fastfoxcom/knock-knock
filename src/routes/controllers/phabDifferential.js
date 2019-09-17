const logger = require('src/utils/logger');
const phabDifferentialService = require('src/services/phabDifferential');

module.exports = {
  sendPhabDifferentialReminder: async (req, res) => {
    let responseCode;
    const response = {
      err: null,
    };
    try {
      const sendPhabDifferentialReminderStatus = await phabDifferentialService.sendPhabDifferentialReminder();
      response.sendPhabDifferentialReminderStatus = sendPhabDifferentialReminderStatus;
      responseCode = 200;
    } catch (e) {
      logger.log(e);
      responseCode = 500;
      response.err = { message: 'Something went wrong.' };
    } finally {
      res.status(responseCode).json(response);
    }
  },
};
