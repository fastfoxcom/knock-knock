const logger = require('src/utils/logger');
const diffusionService = require('src/services/diffusion');

module.exports = {
  sendDiffusionReminder: async (req, res) => {
    let responseCode;
    const response = {
      err: null,
    };
    try {
      const sendDiffusionReminderStatus = await diffusionService.sendDiffusionReminder();
      response.sendDiffusionReminderStatus = sendDiffusionReminderStatus;
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
