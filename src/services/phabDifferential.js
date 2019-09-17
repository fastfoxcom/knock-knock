const config = require('config');

const { post } = require('src/utils/api/request');


const getRepositoryPHIDMap = async ({repositoryPHIDs}) => {
  /*
  $ curl https://phabricator.broex.net/api/differential.repository.search \
    -d api.token=api-token \
    -d constraints[phids][0]=PHID-REPO-tzgid3l6wliwceg2otzm
  */
  let reqObj = {
    url: 'diffusion.repository.search',
    baseURL: config.get('microServiceUrls.phabricator'),
    params: {
      "api.token": "cli-gxuj3u7geydvv7uosdt7ilzaysm5",
    },
  };
  repositoryPHIDs.forEach((repositoryPHID, index) => {
    params[`constraints[phids][${index}]`] = repositoryPHID;
  });
  const { data: { result: { data: repositoryObjects} }} = await post(reqObj);
  const repositoryPHIDMap = {};
  repositoryObjects.forEach(repositoryObject => {
    repositoryPHIDMap[repositoryObject['phid']] = repositoryObject['fields']['name'];
  });
  return repositoryPHIDMap;
}

const getFormattedReviewers = ({reviewers}) => {
  return reviewers.map((reviewer)=>{
    return {
      name: config.has(`developers.${reviewer.reviewerPHID}.name`) ? config.get(`developers.${reviewer.reviewerPHID}.name`) : 'Unknown',
      status: reviewer.status
    }
  });
}

const getActiveDifferentialsData = async ({activeDifferentials}) => {
  let repositoryPHIDs = new Set([]);
  let activeDifferentialsData = [];
  activeDifferentials.forEach(activeDifferential => {
    if (activeDifferential['repositoryPHID']) {
      repositoryPHIDs.add(activeDifferential['repositoryPHID']);
    }
  });
  let repositoryPHIDMap = await getRepositoryPHIDMap({repositoryPHIDs: [...repositoryPHIDs]})
  activeDifferentials.forEach(activeDifferential => {
    activeDifferentialsData.push({
      diffId: activeDifferential.id,
      diffTitle: activeDifferential.fields.title,
      diffAuther: config.has(`developers.${activeDifferential.fields.authorPHID}.name`) ? config.get(`developers.${activeDifferential.fields.authorPHID}.name`) : 'Unknown',
      diffStatus: activeDifferential.fields.status.name,
      diffCreated: activeDifferential.fields.dateCreated,
      diffModified: activeDifferential.fields.dateModified,
      diffReviewers: getFormattedReviewers({reviewers: activeDifferential.attachments.reviewers.reviewers}),
      diffRepository: repositoryPHIDMap[activeDifferential.fields.repositoryPHID]
    });
  });
  return activeDifferentialsData;
}

const getFormattedMessageForSlack = ({activeDifferentialsData}) => {
  /*
  Requiured keys to Format:
  repositoryName
  diffId
  diffTitle
  diffStatus
  diffAuther
  diffReviewers []
  diffCreatedAt
  diffModifiedAt
  diffRepository

  [icrmapp#1560] DCF for HL sales (aravindjayanthi)
  4 days stale · 5 days old · Waiting on @Ishan Khanna, @Anupam Dixit
  */
  return activeDifferentialsData
}

const getActiveDifferentials = async () => {
  /*
  Examples
  curl https://phabricator.broex.net/api/differential.revision.search \
  -d api.token=cli-gxuj3u7geydvv7uosdt7ilzaysm5 \
  -d constraints[statuses][0]=needs-review \
  -d constraints[statuses][1]=needs-revision \
  -d attachments[reviewers]=1
  */
  console.log('trying to get responses');
  let reqObj = {
    url: 'differential.revision.search',
    baseURL: config.get('microServiceUrls.phabricator'),
    params: {
      "api.token": "cli-gxuj3u7geydvv7uosdt7ilzaysm5",
      "constraints[statuses][0]": "needs-review",
      "constraints[statuses][1]": "needs-revision",
      "constraints[statuses][2]": "changes-planned",
      "attachments[reviewers]":1
    },
  };
  const { data: { result: response } } = await post(reqObj);
  return response;
};

module.exports = {
  sendPhabDifferentialReminder: async () => {
    const activeDifferentials = await getActiveDifferentials();
    // TODO:mohit Ignoring pagination for now
    const activeDifferentialsData = await getActiveDifferentialsData({activeDifferentials: activeDifferentials.data});
    const formattedMessageForSlack = getFormattedMessageForSlack({activeDifferentialsData});

    return formattedMessageForSlack;
  }
}
