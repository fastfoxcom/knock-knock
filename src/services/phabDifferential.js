const config = require('config');
const moment = require('moment');

const { post } = require('src/utils/api/request');
const { sendSlackMessage } = require('src/services/slack');

const getRepositoryPHIDMap = async ({repositoryPHIDs}) => {
  /*
  $ curl https://phabricator.broex.net/api/differential.repository.search \
    -d api.token=api-token \
    -d constraints[phids][0]=PHID-REPO-tzgid3l6wliwceg2otzm
  */
  let reqObj = {
    url: 'api/diffusion.repository.search',
    baseURL: config.get('serviceUrls.phabricator'),
    params: {
      "api.token": process.env.PHABRICATOR_CONDUIT_TOKEN,
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
      slackId: config.has(`developers.${reviewer.reviewerPHID}.slackId`) ? config.get(`developers.${reviewer.reviewerPHID}.slackId`) : 'Unknown',
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
      diffAuthorSlackId: config.has(`developers.${activeDifferential.fields.authorPHID}.slackId`) ? config.get(`developers.${activeDifferential.fields.authorPHID}.slackId`) : 'Unknown',
      diffAuthorName: config.has(`developers.${activeDifferential.fields.authorPHID}.name`) ? config.get(`developers.${activeDifferential.fields.authorPHID}.name`) : 'Unknown',
      diffStatus: activeDifferential.fields.status.value,
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
  diffAuthorSlackId
  diffAuthorName
  diffReviewers []
  diffCreatedAt
  diffModifiedAt
  diffRepository

  [icrmapp#1560] DCF for HL sales (aravindjayanthi)
  4 days stale · 5 days old · Waiting on @Ishan Khanna, @Anupam Dixit

  Slack Link format: <https://alert-system.com/alerts/1234|Click here>

  */

  // Ordering by Modified At
  activeDifferentialsData.sort((a, b) => (a.diffModified > b.diffModified) ? -1 : 1)
  
  // Groouping by review status
  let needsReviewDifferentials = [];
  let needsRevisionDifferentials = [];
  activeDifferentialsData.forEach(activeDifferential => {
    if (activeDifferential.diffStatus == "needs-review") {
      needsReviewDifferentials.push(activeDifferential); 
    } else if(activeDifferential.diffStatus == "needs-revision") {
      needsRevisionDifferentials.push(activeDifferential);
    }
  });

  let formattedText = `*Needs Revision*\n\n`;
  needsRevisionDifferentials.forEach(activeDifferential => {
    formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`; 
  });
  formattedText += `*Needs Review*\n\n`;
  needsReviewDifferentials.forEach(activeDifferential => {
    formattedText += `${getFormattedDiffMessage({activeDifferential})}\n\n`; 
  });
  return formattedText
}

const getFormattedDiffMessage = ({activeDifferential}) => {
  const timeStampsInfo = `${moment.unix(activeDifferential.diffModified).fromNow(true)} stale ·  ${moment.unix(activeDifferential.diffCreated).fromNow(true)} old`;
  const reviewStatusIconMap = {
    'blocking': `[!]`,
    'added': `[.]`,
    'accepted': `[✓]`,
    'rejected': `[✗]`,
    'commented': `[✎]`,
    'accepted-older': `~[✓]~`,
    'rejected-older': `~[✗]~`,
    'resigned': `~[.]~`
  };
  let waitingOnInfo = `${activeDifferential.diffReviewers && activeDifferential.diffReviewers.length ? activeDifferential.diffReviewers.map((item) => {return `${item.status in reviewStatusIconMap? reviewStatusIconMap[item.status] : '[?]'} ${item.slackId}`;}).join(`, `) : `${activeDifferential.diffAuthorSlackId} to assign a reviewer`}`;

  if (activeDifferential.diffStatus == `needs-revision`) {
    waitingOnInfo = `${activeDifferential.diffAuthorSlackId} · Review Status - ${waitingOnInfo}`
  }

  return `[${activeDifferential.diffRepository}#D${activeDifferential.diffId}] <${config.get('serviceUrls.phabricator')}D${activeDifferential.diffId}|${activeDifferential.diffTitle}> (${activeDifferential.diffAuthorName})\n${timeStampsInfo} · Waiting on - ${waitingOnInfo}`;
}

const getActiveDifferentials = async () => {
  /*
  Examples
  curl https://phabricator.broex.net/api/differential.revision.search \
  -d api.token=xxxxxxxxxxxxxxx \
  -d constraints[statuses][0]=needs-review \
  -d constraints[statuses][1]=needs-revision \
  -d attachments[reviewers]=1
  */
  let reqObj = {
    url: 'api/differential.revision.search',
    baseURL: config.get('serviceUrls.phabricator'),
    params: {
      "api.token": process.env.PHABRICATOR_CONDUIT_TOKEN,
      "constraints[statuses][0]": "needs-review",
      "constraints[statuses][1]": "needs-revision",
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
    const messageText = getFormattedMessageForSlack({activeDifferentialsData});
    sendSlackMessage({messageText});
    return "Ok";
  }
}
