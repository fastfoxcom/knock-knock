const config = require('config');

const { post } = require('src/utils/api/request');


const getActiveDiffutions = async () => {
    /*
    curl https://phabricator.broex.net/api/differential.revision.search \
    -d api.token=cli-gxuj3u7geydvv7uosdt7ilzaysm5 \
    -d constraints[statuses][0]=needs-review \
    -d constraints[statuses][1]=needs-revision \
    -d attachments[reviewers]=1
    */
    console.log('trying to get responses');
    let reqObj = {
      url: 'https://phabricator.broex.net/api/differential.revision.search',
      //baseURL: config.get('microServiceUrls.phabricator'),
      data: {
        "api.token": "cli-gxuj3u7geydvv7uosdt7ilzaysm5",
        "queryKey":"j9joGhufxJht"
        // "constraints": {
        //   "statuses": ["needs-review", "needs-revision"]
        // }
      },
    };
    console.log(reqObj);
    const { data: { data: response } } = await post(reqObj);
  return response;
};

module.exports = {
  sendDiffusionReminder: async () => {
    const activeDiffusions = await getActiveDiffutions();
    console.log(`activeDiffusions`);
    console.log(activeDiffusions);
    return activeDiffusions;
  }
}
